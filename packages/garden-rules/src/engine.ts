import {
  type Bed,
  DEFAULT_LAST_FROST,
  type IsoDate,
  type Plant,
  type Planting,
  type SowingWithPlantings,
} from '@hochbeet/contracts';
import { resolvePlantings, type RuleContext } from './context';
import type { Finding, Severity, SowingFinding } from './findings';
import { bedEdgeRule } from './rules/bed-edge';
import { cropRotationRule } from './rules/crop-rotation';
import { frostRule } from './rules/frost';
import { heavyFeedersRule } from './rules/heavy-feeders';
import { neighborsRule } from './rules/neighbors';
import { sowingBatchRules, sowingRule } from './rules/sowing';
import { spacingRule } from './rules/spacing';
import { sowingInfos } from './sowings';
import { isActiveInWeek } from './time';

/** All rules in display order. */
const rules = [
  spacingRule,
  neighborsRule,
  heavyFeedersRule,
  cropRotationRule,
  bedEdgeRule,
  frostRule,
  sowingRule,
];

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

export interface EvaluateOptions {
  /** Only return findings that apply in the ISO week containing this date. */
  week?: IsoDate | Date;
  /** The user's last frost as `MM-DD` (GardenSettings); missing means 15 May. */
  lastFrost?: string;
  /**
   * The user's sowing batches with their plantings from all beds (`GET /garden/sowings`), for
   * the rules about planted out seedlings; missing means none.
   */
  sowings?: readonly SowingWithPlantings[];
}

/**
 * Entry point of the rule engine: evaluates all rules for one bed and returns the findings in
 * a stable order. Pure and isomorphic (browser and Node); results are never stored.
 *
 * `plants` are the user's effective plants; plantings with an unknown plant are skipped.
 * With `week`, the whole history is still evaluated (crop rotation needs predecessors), and
 * only findings whose period touches that week are returned.
 */
export function evaluateBed(
  bed: Bed,
  plantings: readonly Planting[],
  plants: readonly Plant[],
  options: EvaluateOptions = {},
): Finding[] {
  const context: RuleContext = {
    bed,
    plantings: resolvePlantings(plantings, plants),
    lastFrost: options.lastFrost ?? DEFAULT_LAST_FROST,
    sowings: sowingInfos(options.sowings ?? [], plants),
  };
  const findings = rules.flatMap((rule) => rule(context));
  const { week } = options;
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
  options: Pick<EvaluateOptions, 'lastFrost'> = {},
): SowingFinding[] {
  const lastFrost = options.lastFrost ?? DEFAULT_LAST_FROST;
  const byId = new Map(plants.map((p) => [p.id, p]));
  return [...sowingInfos(sowings, plants).values()]
    .flatMap((info) => sowingBatchRules(info, byId.get(info.sowing.plantId), lastFrost))
    .sort(
      (a, b) =>
        severityOrder[a.severity] - severityOrder[b.severity] ||
        a.rule.localeCompare(b.rule) ||
        a.sowingId.localeCompare(b.sowingId),
    );
}
