import type { Bed, IsoDate, Plant, Planting, SowingWithPlantings } from '@hochbeet/contracts';
import {
  evaluateBed,
  type EvaluateScope,
  type Finding,
  type Interval,
  isActiveInWeek,
  overlaps,
  type Severity,
  soilRenewalsIn,
  weekStart,
} from '@hochbeet/garden-rules';
import { getISOWeek, getISOWeekYear, parseISO, subDays } from 'date-fns';
import { i18n } from '@/lib/i18n';
import type { Language } from '@/lib/language';
import { familyName, plantName } from '@/lib/plant-names';

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

export interface SeasonOptions {
  /** Language of the texts. */
  language: Language;
  /** The user's last frost (`MM-DD`); missing means 15 May. */
  lastFrost?: string | undefined;
  /** The user's sowing batches, for the rules about planted out seedlings. */
  sowings?: readonly SowingWithPlantings[] | undefined;
  /**
   * `SIMPLE` for the simple view: only the spatial rules for the plantings of the week of
   * `date`, so only findings of that week. `ALL` (default) evaluates the whole season.
   */
  scope?: EvaluateScope | undefined;
}

/**
 * Findings that touch the season of `date`, with all plantings of the bed evaluated; in the
 * simple view only those of the week of `date`.
 */
export function seasonFindings(
  bed: Bed,
  plantings: readonly Planting[],
  plants: readonly Plant[],
  date: IsoDate,
  { language, lastFrost, sowings, scope = 'ALL' }: SeasonOptions,
): Finding[] {
  const texts = {
    locale: language,
    plantName: (plant: Plant) => plantName(plant, language),
    familyName: (plant: Plant) => familyName(plant, language),
  };
  if (scope === 'SIMPLE')
    return evaluateBed(bed, plantings, plants, { ...texts, scope, week: date });
  const season = seasonOf(bed, date);
  const options = {
    ...texts,
    ...(lastFrost ? { lastFrost } : {}),
    ...(sowings ? { sowings } : {}),
  };
  return evaluateBed(bed, plantings, plants, options).filter((f) => overlaps(f.period, season));
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

/**
 * Period of a finding in weeks, e.g. "KW 15 – KW 19 2026" or "ab KW 15 2026"; in English
 * "Week 15 – Week 19 2026" or "from Week 15 2026".
 */
export function formatPeriod(period: Interval, language: Language): string {
  const t = i18n.getFixedT(language, 'editor');
  const weekName = (date: Date) => t('week.name', { week: getISOWeek(date) });
  const start = parseISO(period.start);
  if (period.end === null) {
    return t('week.from', { week: weekName(start), year: getISOWeekYear(start) });
  }
  // The end is the first day without the finding.
  const last = subDays(parseISO(period.end), 1);
  const lastYear = getISOWeekYear(last);
  if (getISOWeekYear(start) !== lastYear) {
    return t('week.rangeAcrossYears', {
      start: weekName(start),
      startYear: getISOWeekYear(start),
      end: weekName(last),
      endYear: lastYear,
    });
  }
  return getISOWeek(start) === getISOWeek(last)
    ? t('week.single', { week: weekName(start), year: lastYear })
    : t('week.range', { start: weekName(start), end: weekName(last), year: lastYear });
}

/** "2 Warnungen · 1 Hinweis · 3 × gute Nachbarn", leaving out what does not occur. */
export function findingsSummary(findings: readonly Finding[], language: Language): string {
  const t = i18n.getFixedT(language, 'editor');
  const of = (s: Severity) => findings.filter((f) => f.severity === s).length;
  const parts = [
    of('WARNING') > 0 && t('findings.warnings', { count: of('WARNING') }),
    of('HINT') > 0 && t('findings.hints', { count: of('HINT') }),
    of('POSITIVE') > 0 && t('findings.positive', { count: of('POSITIVE') }),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : t('findings.none');
}
