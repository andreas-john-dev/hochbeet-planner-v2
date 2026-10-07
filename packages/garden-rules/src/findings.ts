import type { Interval } from './time';

/** Rules of the engine (docs/architecture.md, "Regel-Engine"). */
export type RuleId =
  'SPACING' | 'BAD_NEIGHBOR' | 'GOOD_NEIGHBOR' | 'HEAVY_FEEDER' | 'CROP_ROTATION' | 'BED_EDGE';

/** `WARNING` (red), `POSITIVE` (green, good neighbours) or `HINT` (subtle, e.g. bed edge). */
export type Severity = 'WARNING' | 'POSITIVE' | 'HINT';

/** One result of the rule engine. Never stored; recomputed whenever data changes. */
export interface Finding {
  rule: RuleId;
  severity: Severity;
  /** Affected plantings, sorted, so a pair yields the same finding in any order. */
  plantingIds: string[];
  /** When the finding applies, e.g. the time two plantings share. */
  period: Interval;
  /** German text for the UI. */
  message: string;
}

/**
 * Tolerance in cm for geometric comparisons. Footprints that only touch can come out as
 * -0.0000001 because of floating point; they must not count as overlapping.
 */
export const EPSILON_CM = 1e-6;
