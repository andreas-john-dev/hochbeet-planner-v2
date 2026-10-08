import type { Bed, IsoDate, Plant, Planting } from '@hochbeet/contracts';
import { resolvePlantings, type RuleContext } from './context';
import type { Finding, Severity } from './findings';
import { bedEdgeRule } from './rules/bed-edge';
import { cropRotationRule } from './rules/crop-rotation';
import { heavyFeedersRule } from './rules/heavy-feeders';
import { neighborsRule } from './rules/neighbors';
import { spacingRule } from './rules/spacing';
import { isActiveInWeek } from './time';

/** All rules in display order. */
const rules = [spacingRule, neighborsRule, heavyFeedersRule, cropRotationRule, bedEdgeRule];

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
  const context: RuleContext = { bed, plantings: resolvePlantings(plantings, plants) };
  const findings = rules.flatMap((rule) => rule(context));
  const { week } = options;
  const relevant =
    week === undefined ? findings : findings.filter((f) => isActiveInWeek(f.period, week));
  return relevant.sort(compareFindings);
}
