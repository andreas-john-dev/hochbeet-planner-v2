import { isWeekInWindow, type Plant } from '@hochbeet/contracts';
import { getISOWeek, parseISO } from 'date-fns';
import type { ResolvedPlanting, RuleContext, SowingInfo } from '../context';
import type { Finding, SowingFinding } from '../findings';
import { batchStock } from '../sowings';
import { type Interval, lastFrostDate } from '../time';

/** Weeks the seedlings stay in the raising after the longest raising time before a hint. */
export const LATE_TRANSPLANT_GRACE_WEEKS = 2;

const WEEK_MS = 7 * 86_400_000;

/** Whole weeks from one Monday to another. */
const weeksBetween = (from: string, to: string) =>
  Math.round((Date.parse(to) - Date.parse(from)) / WEEK_MS);

/** ISO week of a sowing date. */
const isoWeek = (date: string) => getISOWeek(parseISO(date));

/**
 * Planned more than the batch has (seeds before germination, seedlings after); done batches
 * count as used up, not as a mistake.
 */
const overplanned = ({ sowing, planned }: SowingInfo) =>
  sowing.stage !== 'DONE' && planned !== undefined && planned > batchStock(sowing);

/** Planned, stock and stage of an overplanned batch, for the texts. */
const stockParams = ({ sowing, planned }: SowingInfo) => ({
  planned: planned ?? 0,
  stock: batchStock(sowing),
  stage: sowing.stage,
});

/** From the earliest start to the latest end; open as soon as one planting is. */
function span(intervals: readonly Interval[]): Interval {
  const start = intervals.map((i) => i.start).sort()[0] ?? '';
  const ends = intervals.map((i) => i.end);
  const end = ends.includes(null) ? null : ([...ends].sort().at(-1) ?? null);
  return { start, end };
}

/**
 * Rules for planted out seedlings from a sowing batch (T-59): planted out before the shortest
 * raising time (warning), left in the raising for more than two weeks after the longest
 * (hint), and more seedlings planned over all beds than the batch has alive (warning on all
 * linked plantings of this bed). Plantings of an unknown or deleted batch get nothing.
 */
export function sowingRule({ plantings, sowings, texts, plantName }: RuleContext): Finding[] {
  if (sowings.size === 0) return [];
  const findings: Finding[] = [];
  const linked = new Map<string, ResolvedPlanting[]>();
  for (const resolved of plantings) {
    const { planting, plant, interval } = resolved;
    const info = planting.sowingId === undefined ? undefined : sowings.get(planting.sowingId);
    if (!info) continue;
    linked.set(info.sowing.id, [...(linked.get(info.sowing.id) ?? []), resolved]);

    const raising = plant.sowing?.propagationWeeks;
    if (!raising) continue;
    const raised = weeksBetween(info.sowing.sowDate, planting.startDate);
    const name = plantName(plant);
    if (raised < raising.min) {
      const params = { plant: name, weeks: raised, minWeeks: raising.min };
      findings.push({
        rule: 'TRANSPLANT_EARLY',
        severity: 'WARNING',
        plantingIds: [planting.id],
        period: interval,
        params,
        message: texts.findings.TRANSPLANT_EARLY(params),
      });
    } else if (raised > raising.max + LATE_TRANSPLANT_GRACE_WEEKS) {
      const params = {
        plant: name,
        weeks: raised,
        minWeeks: raising.min,
        maxWeeks: raising.max,
      };
      findings.push({
        rule: 'TRANSPLANT_LATE',
        severity: 'HINT',
        plantingIds: [planting.id],
        period: interval,
        params,
        message: texts.findings.TRANSPLANT_LATE(params),
      });
    }
  }

  for (const [sowingId, list] of linked) {
    const info = sowings.get(sowingId);
    const first = list[0];
    if (!info || !first || !overplanned(info)) continue;
    const params = {
      plant: plantName(first.plant),
      sowWeek: isoWeek(info.sowing.sowDate),
      ...stockParams(info),
    };
    findings.push({
      rule: 'OVERPLANNED',
      severity: 'WARNING',
      plantingIds: list.map((r) => r.planting.id).sort(),
      period: span(list.map((r) => r.interval)),
      params,
      message: texts.findings.OVERPLANNED(params),
    });
  }
  return findings;
}

/**
 * Findings about one sowing batch (T-59): sown outside the plant's raising window, raising a
 * plant that is only sown directly, more seedlings planned than alive, and planting out a
 * frost sensitive plant on or before the last frost. Done batches get nothing.
 */
export function sowingBatchRules(
  info: SowingInfo,
  plant: Plant | undefined,
  { lastFrost, texts, plantName }: Pick<RuleContext, 'lastFrost' | 'texts' | 'plantName'>,
): SowingFinding[] {
  const { sowing } = info;
  if (sowing.stage === 'DONE') return [];
  const findings: SowingFinding[] = [];
  const base = { sowingId: sowing.id } as const;
  const method = plant?.sowing?.method;
  const window = plant?.sowing?.presowWeeks;
  const sowWeek = isoWeek(sowing.sowDate);
  if (plant && method === 'DIRECT') {
    const params = { plant: plantName(plant) };
    findings.push({
      rule: 'SOWING_DIRECT',
      severity: 'HINT',
      ...base,
      params,
      message: texts.sowingFindings.SOWING_DIRECT(params),
    });
  } else if (plant && window && !isWeekInWindow(sowWeek, window)) {
    const params = { plant: plantName(plant), from: window.from, to: window.to, sowWeek };
    findings.push({
      rule: 'SOWING_WINDOW',
      severity: 'HINT',
      ...base,
      params,
      message: texts.sowingFindings.SOWING_WINDOW(params),
    });
  }
  if (overplanned(info)) {
    const params = stockParams(info);
    findings.push({
      rule: 'OVERPLANNED',
      severity: 'WARNING',
      ...base,
      params,
      message: texts.sowingFindings.OVERPLANNED(params),
    });
  }
  const out = sowing.plannedTransplantDate;
  if (plant?.frostSensitive && out) {
    const frost = lastFrostDate({ lastFrost }, Number(out.slice(0, 4)));
    if (out <= frost) {
      const params = { plant: plantName(plant), lastFrost };
      findings.push({
        rule: 'TRANSPLANT_FROST',
        severity: 'HINT',
        ...base,
        params,
        message: texts.sowingFindings.TRANSPLANT_FROST(params),
      });
    }
  }
  return findings;
}
