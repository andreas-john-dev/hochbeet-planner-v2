import type { SowingStage } from '@hochbeet/contracts';
import { format } from 'date-fns';
import { de as deLocale } from 'date-fns/locale';
import type { Messages, MonthPart } from './types';

const weeks = (n: number) => `${String(n)} ${n === 1 ? 'Woche' : 'Wochen'}`;
const week = (n: number) => `KW ${String(n)}`;

function dayText(monthDay: string): string {
  const [month = 1, day = 1] = monthDay.split('-').map(Number);
  return format(new Date(2001, month - 1, day), 'd. MMMM', { locale: deLocale });
}

const PART: Record<MonthPart, string> = { early: 'Anfang', mid: 'Mitte', late: 'Ende' };

/** What counts as the stock: seeds before germination, seedlings after. */
const stockWord = (stage: SowingStage) =>
  stage === 'PLANNED' ? 'geplant' : stage === 'SOWN' ? 'gesät' : 'vorhanden';

const overplanned = (p: { planned: number; stock: number; stage: SowingStage }) =>
  `${String(p.planned)} verplant, aber nur ${String(p.stock)} ${stockWord(p.stage)}`;

const pair = (first: string, second: string) => `${first} und ${second}`;

/** German texts; the source of all others. */
export const de: Messages = {
  dateLocale: deLocale,
  collation: 'de',
  weekLabel: week,
  weekInText: week,
  weeks,
  dayText,
  weekRangePatterns: {
    sameMonth: 'd.',
    sameYear: 'd. MMMM',
    otherYear: 'd. MMMM yyyy',
    end: 'd. MMMM yyyy',
  },
  weekHint: (part, month) => `${PART[part]} ${month}`,
  windowText: ({ range, from, to }) =>
    to === undefined ? `KW ${range} (${from})` : `KW ${range} (${from} bis ${to})`,
  pair,
  findings: {
    SPACING: (p) =>
      `${pair(...p.plants)} stehen zu eng: Die Standflächen überlappen um ${String(p.overlapCm)} cm.`,
    BAD_NEIGHBOR: (p) => `${pair(...p.plants)} sind schlechte Nachbarn.`,
    GOOD_NEIGHBOR: (p) => `${pair(...p.plants)} sind gute Nachbarn.`,
    HEAVY_FEEDER: (p) =>
      `${pair(...p.plants)} sind Starkzehrer und stehen mit ${String(p.gapCm)} cm Lücke nebeneinander (mindestens ${String(p.minGapCm)} cm empfohlen).`,
    CROP_ROTATION: (p) =>
      `${p.plant} folgt am selben Platz direkt auf ${p.predecessor} (beide ${p.family}) ohne Erneuerung der Erde.`,
    BED_EDGE: (p) => `${p.plant} ragt über den Beetrand.`,
    FROST: (p) =>
      `${p.plant} ist frostempfindlich und sollte erst nach dem ${dayText(p.lastFrost)} ins Beet.`,
    TRANSPLANT_EARLY: (p) =>
      `${p.plant} wurde nach ${weeks(p.weeks)} Anzucht ausgepflanzt, braucht aber mindestens ${weeks(p.minWeeks)}.`,
    TRANSPLANT_LATE: (p) =>
      `${p.plant} stand ${weeks(p.weeks)} in der Anzucht, üblich sind ${String(p.minWeeks)}–${weeks(p.maxWeeks)}.`,
    OVERPLANNED: (p) => `Aus der Anzucht ${p.plant} (${week(p.sowWeek)}) sind ${overplanned(p)}.`,
  },
  sowingFindings: {
    SOWING_WINDOW: (p) =>
      `${p.plant} wird üblicherweise in KW ${String(p.from)}–${String(p.to)} vorgezogen, gesät ist in ${week(p.sowWeek)}.`,
    SOWING_DIRECT: (p) => `${p.plant} wird direkt gesät und verträgt Umpflanzen schlecht.`,
    OVERPLANNED: (p) => `Mehr in Beeten verplant als vorhanden: ${overplanned(p)}.`,
    TRANSPLANT_FROST: (p) =>
      `${p.plant} ist frostempfindlich: Auspflanzen erst nach dem ${dayText(p.lastFrost)} planen.`,
  },
};
