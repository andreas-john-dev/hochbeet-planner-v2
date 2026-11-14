import type { Locale } from 'date-fns';
import type { FindingParams, RuleId, SowingFindingParams, SowingRuleId } from '../findings';

/** Where a week lies in its month, as on seed packets ("Anfang März", "early March"). */
export type MonthPart = 'early' | 'mid' | 'late';

/**
 * All texts of the rule engine in one language: plain functions, no i18next, so the engine
 * stays pure and runs in services and the assistant's tools as well.
 */
export interface Messages {
  /** date-fns locale for month names. */
  dateLocale: Locale;
  /** BCP 47 tag for sorting names in pair texts. */
  collation: string;
  /** "KW 38" / "Week 38": a week on its own, e.g. as a label. */
  weekLabel: (week: number) => string;
  /** "KW 38" / "week 38": a week within a sentence. */
  weekInText: (week: number) => string;
  /** "3 Wochen" / "3 weeks". */
  weeks: (count: number) => string;
  /** "15. Mai" / "15 May" for a month and day as `MM-DD`. */
  dayText: (monthDay: string) => string;
  /** Date patterns of a week's range: start in the same month, same year, other year; end. */
  weekRangePatterns: { sameMonth: string; sameYear: string; otherYear: string; end: string };
  /** "Anfang März" / "early March". */
  weekHint: (part: MonthPart, month: string) => string;
  /** "KW 10–14 (Anfang März bis Anfang April)"; `range` is "10–14" or "20". */
  windowText: (window: { range: string; from: string; to?: string }) => string;
  /** "A und B" / "A and B". */
  pair: (first: string, second: string) => string;
  /** Text of every finding at plantings, from its parameters. */
  findings: { [R in RuleId]: (params: FindingParams[R]) => string };
  /** Text of every finding at sowing batches, from its parameters. */
  sowingFindings: { [R in SowingRuleId]: (params: SowingFindingParams[R]) => string };
}
