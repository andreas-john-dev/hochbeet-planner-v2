import type { Bed, IsoDate, Plant, Planting } from '@hochbeet/contracts';
import {
  evaluateBed,
  type Finding,
  type Interval,
  isActiveInWeek,
  overlaps,
  type Severity,
  soilRenewalsIn,
  weekStart,
} from '@hochbeet/garden-rules';
import { getISOWeek, getISOWeekYear, parseISO, subDays } from 'date-fns';

/**
 * The season containing `date`: from the last soil renewal on or before it up to the next
 * renewal (1 March unless the bed has own dates). The rules treat seasons as separate beds.
 */
export function seasonOf(bed: Pick<Bed, 'soilRenewals'>, date: IsoDate): Interval {
  const year = Number(date.slice(0, 4));
  const renewals = [year - 1, year, year + 1].flatMap((y) => soilRenewalsIn(bed, y));
  const start = renewals.filter((r) => r <= date).at(-1) ?? `${String(year - 1)}-03-01`;
  const end = renewals.find((r) => r > date) ?? null;
  return { start, end };
}

/** Findings that touch the season of `date`, with all plantings of the bed evaluated. */
export function seasonFindings(
  bed: Bed,
  plantings: readonly Planting[],
  plants: readonly Plant[],
  date: IsoDate,
): Finding[] {
  const season = seasonOf(bed, date);
  return evaluateBed(bed, plantings, plants).filter((f) => overlaps(f.period, season));
}

const rank: Record<Severity, number> = { WARNING: 3, HINT: 2, POSITIVE: 1 };

/** Most serious finding per planting id: a warning beats a hint, which beats a good neighbour. */
export function statusByPlanting(findings: readonly Finding[]): Map<string, Severity> {
  const status = new Map<string, Severity>();
  for (const finding of findings) {
    for (const id of finding.plantingIds) {
      const current = status.get(id);
      if (!current || rank[finding.severity] > rank[current]) status.set(id, finding.severity);
    }
  }
  return status;
}

/** Week to show for a finding: the current one if the finding applies there, else its first. */
export function weekOfFinding(finding: Finding, week: IsoDate): IsoDate {
  return isActiveInWeek(finding.period, week) ? week : weekStart(finding.period.start);
}

const weekName = (date: Date) => `KW ${String(getISOWeek(date))}`;

/** Period of a finding in weeks, e.g. "KW 15 – KW 19 2026" or "ab KW 15 2026". */
export function formatPeriod(period: Interval): string {
  const start = parseISO(period.start);
  if (period.end === null) return `ab ${weekName(start)} ${String(getISOWeekYear(start))}`;
  // The end is the first day without the finding.
  const last = subDays(parseISO(period.end), 1);
  const lastYear = getISOWeekYear(last);
  if (getISOWeekYear(start) !== lastYear) {
    return `${weekName(start)} ${String(getISOWeekYear(start))} – ${weekName(last)} ${String(lastYear)}`;
  }
  return getISOWeek(start) === getISOWeek(last)
    ? `${weekName(start)} ${String(lastYear)}`
    : `${weekName(start)} – ${weekName(last)} ${String(lastYear)}`;
}

const count = (n: number, one: string, many: string) => `${String(n)} ${n === 1 ? one : many}`;

/** "2 Warnungen · 1 Hinweis · 3 × gute Nachbarn", leaving out what does not occur. */
export function findingsSummary(findings: readonly Finding[]): string {
  const of = (s: Severity) => findings.filter((f) => f.severity === s).length;
  const parts = [
    of('WARNING') > 0 && count(of('WARNING'), 'Warnung', 'Warnungen'),
    of('HINT') > 0 && count(of('HINT'), 'Hinweis', 'Hinweise'),
    of('POSITIVE') > 0 && `${String(of('POSITIVE'))} × gute Nachbarn`,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : 'Keine Warnungen';
}
