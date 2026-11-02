import { isWeekInWindow, type Plant } from '@hochbeet/contracts';
import { format, getISOWeek, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import type { ResolvedPlanting, RuleContext, SowingInfo } from '../context';
import type { Finding, SowingFinding } from '../findings';
import { type Interval, lastFrostDate } from '../time';

/** Weeks the seedlings stay in the raising after the longest raising time before a hint. */
export const LATE_TRANSPLANT_GRACE_WEEKS = 2;

const WEEK_MS = 7 * 86_400_000;

/** Whole weeks from one Monday to another. */
const weeksBetween = (from: string, to: string) =>
  Math.round((Date.parse(to) - Date.parse(from)) / WEEK_MS);

const weeks = (n: number) => `${String(n)} ${n === 1 ? 'Woche' : 'Wochen'}`;

/** "KW 38" of a sowing week. */
const weekName = (date: string) => `KW ${String(getISOWeek(parseISO(date)))}`;

/** "15. Mai" for `MM-DD`. */
function dayText(lastFrost: string): string {
  const [month = 1, day = 1] = lastFrost.split('-').map(Number);
  return format(new Date(2001, month - 1, day), 'd. MMMM', { locale: de });
}

/** Planned more seedlings than are alive; done batches count as used up, not as a mistake. */
const overplanned = ({ sowing, planned }: SowingInfo) =>
  sowing.stage !== 'DONE' && planned !== undefined && planned > sowing.aliveCount;

const overplannedText = ({ sowing, planned }: SowingInfo) =>
  `${String(planned ?? 0)} verplant, aber nur ${String(sowing.aliveCount)} vorhanden`;

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
export function sowingRule({ plantings, sowings }: RuleContext): Finding[] {
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
    if (raised < raising.min) {
      findings.push({
        rule: 'TRANSPLANT_EARLY',
        severity: 'WARNING',
        plantingIds: [planting.id],
        period: interval,
        message: `${plant.name} wurde nach ${weeks(raised)} Anzucht ausgepflanzt, braucht aber mindestens ${weeks(raising.min)}.`,
      });
    } else if (raised > raising.max + LATE_TRANSPLANT_GRACE_WEEKS) {
      findings.push({
        rule: 'TRANSPLANT_LATE',
        severity: 'HINT',
        plantingIds: [planting.id],
        period: interval,
        message: `${plant.name} stand ${weeks(raised)} in der Anzucht, üblich sind ${String(raising.min)}–${weeks(raising.max)}.`,
      });
    }
  }

  for (const [sowingId, list] of linked) {
    const info = sowings.get(sowingId);
    const first = list[0];
    if (!info || !first || !overplanned(info)) continue;
    findings.push({
      rule: 'OVERPLANNED',
      severity: 'WARNING',
      plantingIds: list.map((r) => r.planting.id).sort(),
      period: span(list.map((r) => r.interval)),
      message: `Aus der Anzucht ${first.plant.name} (${weekName(info.sowing.sowDate)}) sind ${overplannedText(info)}.`,
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
  lastFrost: string,
): SowingFinding[] {
  const { sowing } = info;
  if (sowing.stage === 'DONE') return [];
  const findings: SowingFinding[] = [];
  const of = (rule: SowingFinding['rule'], severity: SowingFinding['severity'], message: string) =>
    findings.push({ rule, severity, sowingId: sowing.id, message });

  const method = plant?.sowing?.method;
  const window = plant?.sowing?.presowWeeks;
  if (plant && method === 'DIRECT') {
    of(
      'SOWING_DIRECT',
      'HINT',
      `${plant.name} wird direkt gesät und verträgt Umpflanzen schlecht.`,
    );
  } else if (plant && window && !isWeekInWindow(getISOWeek(parseISO(sowing.sowDate)), window)) {
    of(
      'SOWING_WINDOW',
      'HINT',
      `${plant.name} wird üblicherweise in KW ${String(window.from)}–${String(window.to)} vorgezogen, gesät ist in ${weekName(sowing.sowDate)}.`,
    );
  }
  if (overplanned(info)) {
    of(
      'OVERPLANNED',
      'WARNING',
      `Mehr in Beeten verplant als vorhanden: ${overplannedText(info)}.`,
    );
  }
  const out = sowing.plannedTransplantDate;
  if (plant?.frostSensitive && out) {
    const frost = lastFrostDate({ lastFrost }, Number(out.slice(0, 4)));
    if (out <= frost) {
      of(
        'TRANSPLANT_FROST',
        'HINT',
        `${plant.name} ist frostempfindlich: Auspflanzen erst nach dem ${dayText(lastFrost)} planen.`,
      );
    }
  }
  return findings;
}
