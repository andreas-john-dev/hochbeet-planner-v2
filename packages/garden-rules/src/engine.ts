import {
  type Bed,
  DEFAULT_LAST_FROST,
  type IsoDate,
  type Plant,
  type Planting,
  type SowingWithPlantings,
} from '@hochbeet/contracts';
import { resolvePlantings, type RuleContext } from './context';
import type { RulesLocale } from './locale';
import { messagesFor } from './messages';
import type { Finding, RuleId, Severity, SowingFinding } from './findings';
import { bedEdgeRule } from './rules/bed-edge';
import { cropRotationRule } from './rules/crop-rotation';
import { frostRule } from './rules/frost';
import { heavyFeedersRule } from './rules/heavy-feeders';
import { neighborsRule } from './rules/neighbors';
import { sowingBatchRules, sowingRule } from './rules/sowing';
import { spacingRule } from './rules/spacing';
import { sowingInfos } from './sowings';
import { isActiveInWeek } from './time';

/** A rule of `evaluateBed()` with the findings it produces. */
export interface BedRule {
  rule: (ctx: RuleContext) => Finding[];
  /** Rule codes of its findings; every code of `RULE_IDS` belongs to exactly one rule. */
  ids: readonly RuleId[];
  /**
   * Whether the rule needs more than the plantings of one week: the history (crop rotation),
   * the date (frost) or the sowing batches. Time dependent rules are left out of the simple
   * view (`scope: 'SIMPLE'`). Every new rule has to decide.
   */
  timeDependent: boolean;
}

/** All rules of `evaluateBed()` in display order. */
export const BED_RULES: readonly BedRule[] = [
  { rule: spacingRule, ids: ['SPACING'], timeDependent: false },
  { rule: neighborsRule, ids: ['BAD_NEIGHBOR', 'GOOD_NEIGHBOR'], timeDependent: false },
  { rule: heavyFeedersRule, ids: ['HEAVY_FEEDER'], timeDependent: false },
  { rule: cropRotationRule, ids: ['CROP_ROTATION'], timeDependent: true },
  { rule: bedEdgeRule, ids: ['BED_EDGE'], timeDependent: false },
  { rule: frostRule, ids: ['FROST'], timeDependent: true },
  {
    rule: sowingRule,
    ids: ['TRANSPLANT_EARLY', 'TRANSPLANT_LATE', 'OVERPLANNED'],
    timeDependent: true,
  },
];

/** Rules of `evaluateBed()`: all of them, or only those of the simple view. */
export const EVALUATE_SCOPES = ['ALL', 'SIMPLE'] as const;
export type EvaluateScope = (typeof EVALUATE_SCOPES)[number];

/** The rule codes `evaluateBed()` can return in a scope, in display order. */
export function ruleIdsInScope(scope: EvaluateScope): RuleId[] {
  return BED_RULES.filter((entry) => scope === 'ALL' || !entry.timeDependent).flatMap(
    (entry) => entry.ids,
  );
}

const severityOrder: Record<Severity, number> = { WARNING: 0, HINT: 1, POSITIVE: 2 };

/** Stable order: warnings first, then by rule, plantings and period. */
function compareFindings(a: Finding, b: Finding): number {
  return (
    severityOrder[a.severity] - severityOrder[b.severity] ||
    a.rule.localeCompare(b.rule) ||
    a.plantingIds.join(',').localeCompare(b.plantingIds.join(',')) ||
    a.period.start.localeCompare(b.period.start) ||
    (a.period.end ?? '9999').localeCompare(b.period.end ?? '9999')
  );
}

interface CommonEvaluateOptions {
  /** The user's last frost as `MM-DD` (GardenSettings); missing means 15 May. */
  lastFrost?: string;
  /**
   * The user's sowing batches with their plantings from all beds (`GET /garden/sowings`), for
   * the rules about planted out seedlings; missing means none.
   */
  sowings?: readonly SowingWithPlantings[];
  /** Language of `message` (German by default); `params` are the same in every language. */
  locale?: RulesLocale;
  /** Name of a plant in the texts; the stored name by default (e.g. `plantName()` of contracts). */
  plantName?: (plant: Plant) => string;
  /**
   * Family of a plant in the texts; the stored family by default. Crop rotation always
   * compares the stored `family`.
   */
  familyName?: (plant: Plant) => string;
}

/**
 * Options of `evaluateBed()`. `scope: 'SIMPLE'` (simple view) evaluates only the spatial rules
 * (spacing, neighbours, heavy feeders, bed edge) for the plantings of one week, so it needs
 * `week`. `ALL` is the default.
 */
export type EvaluateOptions = CommonEvaluateOptions &
  (
    | {
        scope?: 'ALL';
        /** Only return findings that apply in the ISO week containing this date. */
        week?: IsoDate | Date;
      }
    | {
        scope: 'SIMPLE';
        /** The ISO week containing this date; only its plantings and findings count. */
        week: IsoDate | Date;
      }
  );

const storedName = (plant: Plant) => plant.name;
const storedFamily = (plant: Plant) => plant.family;

/** Texts and names for the rules, from the options. */
const textOptions = (options: Pick<EvaluateOptions, 'locale' | 'plantName' | 'familyName'>) => ({
  texts: messagesFor(options.locale),
  plantName: options.plantName ?? storedName,
  familyName: options.familyName ?? storedFamily,
});

/**
 * Entry point of the rule engine: evaluates the rules for one bed and returns the findings in
 * a stable order. Pure and isomorphic (browser and Node); results are never stored.
 *
 * `plants` are the user's effective plants; plantings with an unknown plant are skipped.
 * With `week`, the whole history is still evaluated (crop rotation needs predecessors), and
 * only findings whose period touches that week are returned. With `scope: 'SIMPLE'` only the
 * rules that are not time dependent run, on the plantings of `week`; for that week they find
 * the same as with `ALL`.
 */
export function evaluateBed(
  bed: Bed,
  plantings: readonly Planting[],
  plants: readonly Plant[],
  options: EvaluateOptions = {},
): Finding[] {
  const { week, scope = 'ALL' } = options;
  // Callers without TypeScript may still leave out the week.
  if (scope === 'SIMPLE' && week === undefined)
    throw new Error("evaluateBed: scope 'SIMPLE' needs a week");
  const resolved = resolvePlantings(plantings, plants);
  const simple = scope === 'SIMPLE' && week !== undefined;
  const context: RuleContext = {
    bed,
    plantings: simple ? resolved.filter((item) => isActiveInWeek(item.interval, week)) : resolved,
    lastFrost: options.lastFrost ?? DEFAULT_LAST_FROST,
    sowings: simple ? new Map() : sowingInfos(options.sowings ?? [], plants),
    ...textOptions(options),
  };
  const findings = BED_RULES.filter((entry) => !simple || !entry.timeDependent).flatMap((entry) =>
    entry.rule(context),
  );
  const relevant =
    week === undefined ? findings : findings.filter((f) => isActiveInWeek(f.period, week));
  return relevant.sort(compareFindings);
}

/**
 * Second entry point, for the sowing page: findings about the batches themselves (raising
 * window, plants only sown directly, more planned than alive, planting out before the frost).
 * Findings at plantings come from `evaluateBed()` with `sowings`; this one has no bed. Sorted
 * by severity, rule and batch, so the order of `sowings` does not matter.
 */
export function evaluateSowings(
  sowings: readonly SowingWithPlantings[],
  plants: readonly Plant[],
  options: Pick<EvaluateOptions, 'lastFrost' | 'locale' | 'plantName' | 'familyName'> = {},
): SowingFinding[] {
  const context = { lastFrost: options.lastFrost ?? DEFAULT_LAST_FROST, ...textOptions(options) };
  const byId = new Map(plants.map((p) => [p.id, p]));
  return [...sowingInfos(sowings, plants).values()]
    .flatMap((info) => sowingBatchRules(info, byId.get(info.sowing.plantId), context))
    .sort(
      (a, b) =>
        severityOrder[a.severity] - severityOrder[b.severity] ||
        a.rule.localeCompare(b.rule) ||
        a.sowingId.localeCompare(b.sowingId),
    );
}
