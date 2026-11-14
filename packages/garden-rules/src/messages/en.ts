import type { SowingStage } from '@hochbeet/contracts';
import { format } from 'date-fns';
import { enGB } from 'date-fns/locale';
import type { Messages, MonthPart } from './types';

const weeks = (n: number) => `${String(n)} ${n === 1 ? 'week' : 'weeks'}`;
const week = (n: number) => `week ${String(n)}`;

function dayText(monthDay: string): string {
  const [month = 1, day = 1] = monthDay.split('-').map(Number);
  return format(new Date(2001, month - 1, day), 'd MMMM', { locale: enGB });
}

const PART: Record<MonthPart, string> = { early: 'early', mid: 'mid', late: 'late' };

/** What counts as the stock: seeds before germination, seedlings after. */
const stockWord = (stage: SowingStage) =>
  stage === 'PLANNED' ? 'to be sown' : stage === 'SOWN' ? 'sown' : 'available';

const overplanned = (p: { planned: number; stock: number; stage: SowingStage }) =>
  `${String(p.planned)} planned, but only ${String(p.stock)} ${stockWord(p.stage)}`;

const pair = (first: string, second: string) => `${first} and ${second}`;

/** British English texts, translated from `de.ts`. */
export const en: Messages = {
  dateLocale: enGB,
  collation: 'en-GB',
  weekLabel: (n) => `Week ${String(n)}`,
  weekInText: week,
  weeks,
  dayText,
  weekRangePatterns: {
    sameMonth: 'd',
    sameYear: 'd MMMM',
    otherYear: 'd MMMM yyyy',
    end: 'd MMMM yyyy',
  },
  weekHint: (part, month) => `${PART[part]} ${month}`,
  windowText: ({ range, from, to }) =>
    to === undefined ? `week ${range} (${from})` : `weeks ${range} (${from} to ${to})`,
  pair,
  findings: {
    SPACING: (p) =>
      `${pair(...p.plants)} are too close: their footprints overlap by ${String(p.overlapCm)} cm.`,
    BAD_NEIGHBOR: (p) => `${pair(...p.plants)} are bad neighbours.`,
    GOOD_NEIGHBOR: (p) => `${pair(...p.plants)} are good neighbours.`,
    HEAVY_FEEDER: (p) =>
      `${pair(...p.plants)} are heavy feeders and stand side by side with a ${String(p.gapCm)} cm gap (at least ${String(p.minGapCm)} cm recommended).`,
    CROP_ROTATION: (p) =>
      `${p.plant} directly follows ${p.predecessor} in the same spot (both ${p.family}) without renewing the soil.`,
    BED_EDGE: (p) => `${p.plant} reaches beyond the edge of the bed.`,
    FROST: (p) =>
      `${p.plant} is frost-sensitive and should only go into the bed after ${dayText(p.lastFrost)}.`,
    TRANSPLANT_EARLY: (p) =>
      `${p.plant} was planted out after ${weeks(p.weeks)} indoors but needs at least ${weeks(p.minWeeks)}.`,
    TRANSPLANT_LATE: (p) =>
      `${p.plant} stayed indoors for ${weeks(p.weeks)}; ${String(p.minWeeks)}–${weeks(p.maxWeeks)} are usual.`,
    OVERPLANNED: (p) => `Seedlings of ${p.plant} (${week(p.sowWeek)}): ${overplanned(p)}.`,
  },
  sowingFindings: {
    SOWING_WINDOW: (p) =>
      `${p.plant} is usually started indoors in weeks ${String(p.from)}–${String(p.to)}; this was sown in ${week(p.sowWeek)}.`,
    SOWING_DIRECT: (p) => `${p.plant} is sown directly and does not transplant well.`,
    OVERPLANNED: (p) => `More planned in beds than available: ${overplanned(p)}.`,
    TRANSPLANT_FROST: (p) =>
      `${p.plant} is frost-sensitive: plan to plant out only after ${dayText(p.lastFrost)}.`,
  },
};
