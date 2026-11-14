import type { SowingStage } from '@hochbeet/contracts';
import type { Interval } from './time';

/** Rules of the engine (docs/architecture/rules.md). */
export const RULE_IDS = [
  'SPACING',
  'BAD_NEIGHBOR',
  'GOOD_NEIGHBOR',
  'HEAVY_FEEDER',
  'CROP_ROTATION',
  'BED_EDGE',
  'FROST',
  'TRANSPLANT_EARLY',
  'TRANSPLANT_LATE',
  'OVERPLANNED',
] as const;
export type RuleId = (typeof RULE_IDS)[number];

/** Rules about sowing batches (`evaluateSowings()`). */
export const SOWING_RULE_IDS = [
  'SOWING_WINDOW',
  'SOWING_DIRECT',
  'OVERPLANNED',
  'TRANSPLANT_FROST',
] as const;
export type SowingRuleId = (typeof SOWING_RULE_IDS)[number];

/** `WARNING` (red), `POSITIVE` (green, good neighbours) or `HINT` (subtle, e.g. bed edge). */
export type Severity = 'WARNING' | 'POSITIVE' | 'HINT';

/** Two plant names in alphabetical order of the language, so input order does not matter. */
type Pair = [string, string];

/**
 * Values behind the text of each rule, so callers never have to parse `message`. Plant names
 * are display names (`EvaluateOptions.plantName`), last frost is `MM-DD`, weeks are ISO weeks.
 */
export interface FindingParams {
  SPACING: { plants: Pair; overlapCm: number };
  BAD_NEIGHBOR: { plants: Pair };
  GOOD_NEIGHBOR: { plants: Pair };
  HEAVY_FEEDER: { plants: Pair; gapCm: number; minGapCm: number };
  CROP_ROTATION: { plant: string; predecessor: string; family: string };
  BED_EDGE: { plant: string };
  FROST: { plant: string; lastFrost: string };
  TRANSPLANT_EARLY: { plant: string; weeks: number; minWeeks: number };
  TRANSPLANT_LATE: { plant: string; weeks: number; minWeeks: number; maxWeeks: number };
  OVERPLANNED: {
    plant: string;
    sowWeek: number;
    planned: number;
    stock: number;
    stage: SowingStage;
  };
}

/** Values behind the text of each finding at a sowing batch. */
export interface SowingFindingParams {
  SOWING_WINDOW: { plant: string; from: number; to: number; sowWeek: number };
  SOWING_DIRECT: { plant: string };
  OVERPLANNED: { planned: number; stock: number; stage: SowingStage };
  TRANSPLANT_FROST: { plant: string; lastFrost: string };
}

interface FindingBase {
  severity: Severity;
  /** Affected plantings, sorted, so a pair yields the same finding in any order. */
  plantingIds: string[];
  /** When the finding applies, e.g. the time two plantings share. */
  period: Interval;
  /** Text for the UI in the language of `EvaluateOptions.locale` (German by default). */
  message: string;
}

/** One result of the rule engine. Never stored; recomputed whenever data changes. */
export type Finding = {
  [R in RuleId]: FindingBase & { rule: R; params: FindingParams[R] };
}[RuleId];

/** One result about a sowing batch, shown on the sowing page. Never stored either. */
export type SowingFinding = {
  [R in SowingRuleId]: {
    rule: R;
    severity: Exclude<Severity, 'POSITIVE'>;
    sowingId: string;
    params: SowingFindingParams[R];
    /** Text for the UI in the language of `locale` (German by default). */
    message: string;
  };
}[SowingRuleId];

/**
 * Tolerance in cm for geometric comparisons. Footprints that only touch can come out as
 * -0.0000001 because of floating point; they must not count as overlapping.
 */
export const EPSILON_CM = 1e-6;
