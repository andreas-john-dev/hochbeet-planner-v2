import {
  MAX_SOWING_COUNT,
  type Plant,
  type Planting,
  type SowingBatch,
  type SowingBatchFields,
  type SowingStage,
  type SowingWithPlantings,
} from '@hochbeet/contracts';
import {
  batchStock,
  formatWeek,
  lastFrostDate,
  plantCount,
  plannedCount,
  weekStart,
} from '@hochbeet/garden-rules';
import { addWeeks, formatISO, parseISO } from 'date-fns';
import type { PreviewSowing } from './editor/store';
import { i18n } from './i18n';
import { intlLocale, type Language } from './language';

/** The stages in order; `DONE` comes only through „Abschließen“. */
export const STAGES: readonly SowingStage[] = [
  'PLANNED',
  'SOWN',
  'GERMINATED',
  'PRICKED',
  'HARDENING',
  'DONE',
];

/** Seedlings only exist from germination on; before that the batch is seeds. */
export const hasSeedlings = (stage: SowingStage) => STAGES.indexOf(stage) >= 2;

/** The stage „Weiter“ leads to; none after hardening off (then the batch is completed). */
export function nextStage(stage: SowingStage): SowingStage | undefined {
  const next = STAGES[STAGES.indexOf(stage) + 1];
  return next === 'DONE' ? undefined : next;
}

export const fieldsOf = ({ id: _id, ...fields }: SowingBatch): SowingBatchFields => fields;

/** The batch one stage further; on germination the stock starts at the sown amount. */
export function advance(batch: SowingBatch): SowingBatchFields {
  const stage = nextStage(batch.stage);
  if (!stage) return fieldsOf(batch);
  return {
    ...fieldsOf(batch),
    stage,
    ...(stage === 'GERMINATED' ? { aliveCount: batch.sownCount } : {}),
  };
}

/** „Abschließen“: nothing left, the batch is done. */
export const complete = (batch: SowingBatch): SowingBatchFields => ({
  ...fieldsOf(batch),
  stage: 'DONE',
  aliveCount: 0,
});

/** The batch with a new stock, kept within what the contract allows. */
export const withAlive = (batch: SowingBatch, aliveCount: number): SowingBatchFields => ({
  ...fieldsOf(batch),
  aliveCount: Math.min(MAX_SOWING_COUNT, Math.max(0, aliveCount)),
});

export type SowingFilter = 'active' | 'done' | 'all';

export const SOWING_FILTERS: readonly SowingFilter[] = ['active', 'done', 'all'];

export function filterSowings(
  sowings: readonly SowingWithPlantings[],
  filter: SowingFilter,
): SowingWithPlantings[] {
  return sowings.filter(
    ({ sowing }) => filter === 'all' || (sowing.stage === 'DONE') === (filter === 'done'),
  );
}

/** Batches by year of sowing, newest year first; within a year by sowing week. */
export function groupByYear(
  sowings: readonly SowingWithPlantings[],
): { year: number; sowings: SowingWithPlantings[] }[] {
  const sorted = [...sowings].sort(
    (a, b) =>
      a.sowing.sowDate.localeCompare(b.sowing.sowDate) || a.sowing.id.localeCompare(b.sowing.id),
  );
  const years = new Map<number, SowingWithPlantings[]>();
  for (const item of sorted) {
    const year = Number(item.sowing.sowDate.slice(0, 4));
    years.set(year, [...(years.get(year) ?? []), item]);
  }
  return [...years.entries()]
    .sort(([a], [b]) => b - a)
    .map(([year, list]) => ({ year, sowings: list }));
}

export interface Stock {
  alive: number;
  /** Plants of all linked plantings; undefined if the plant is unknown. */
  planned: number | undefined;
  /** Alive minus planned; negative when more is planned than lives. */
  free: number | undefined;
}

export function stockOf(item: SowingWithPlantings, plants: readonly Plant[]): Stock {
  const planned = plannedCount(item, plants);
  const alive = item.sowing.aliveCount;
  return { alive, planned, free: planned === undefined ? undefined : alive - planned };
}

const count = (n: number | undefined) =>
  n === undefined ? '–' : n < 0 ? `−${String(-n)}` : String(n);

/**
 * The stock in one line: „lebend 18 · verplant 12 · frei 6“ for seedlings, the sown (or
 * planned) amount before germination, with what is already planned into beds.
 */
export function stockText(sowing: SowingBatch, stock: Stock, language: Language): string {
  const t = i18n.getFixedT(language, 'sowings');
  if (!hasSeedlings(sowing.stage)) {
    const seeds = t(sowing.stage === 'PLANNED' ? 'stock.planned' : 'stock.sown', {
      count: sowing.sownCount,
    });
    return stock.planned
      ? t('stock.seedsAllocated', { seeds, planned: count(stock.planned) })
      : seeds;
  }
  return t('stock.seedlings', {
    alive: count(stock.alive),
    planned: count(stock.planned),
    free: count(stock.free),
  });
}

/** „18 von 24 gekeimt“, while the batch has just germinated. */
export function germinationText(sowing: SowingBatch, language: Language): string | undefined {
  return sowing.stage === 'GERMINATED'
    ? i18n.getFixedT(language, 'sowings')('stock.germinated', {
        alive: sowing.aliveCount,
        sown: sowing.sownCount,
      })
    : undefined;
}

/** „KW 11 · 9. – 15. März 2026“ */
export function weekText(date: string): string {
  const { week, range } = formatWeek(date);
  return `${week} · ${range}`;
}

/** Plants that can be raised indoors first, then the others; each by name. */
export function plantsForSowing<T extends Pick<Plant, 'name' | 'sowing'>>(
  plants: readonly T[],
): T[] {
  const raised = (p: T) => (p.sowing && p.sowing.method !== 'DIRECT' ? 0 : 1);
  return [...plants].sort((a, b) => raised(a) - raised(b) || a.name.localeCompare(b.name, 'de'));
}

/** New batches in the current week or earlier are sown, later ones planned. */
export const defaultStage = (sowDate: string, today: Date): SowingStage =>
  sowDate > weekStart(today) ? 'PLANNED' : 'SOWN';

const isoDate = (date: Date) => formatISO(date, { representation: 'date' });

/**
 * When the seedlings may go out: sowing plus the longest raising time, for frost sensitive
 * plants not before the Monday after the last frost of that year. Undefined for plants
 * without raising time.
 */
export function defaultTransplantDate(
  plant: Pick<Plant, 'sowing' | 'frostSensitive'>,
  sowDate: string,
  lastFrost: string,
): string | undefined {
  const weeks = plant.sowing?.propagationWeeks?.max;
  if (weeks === undefined) return undefined;
  const date = isoDate(addWeeks(parseISO(sowDate), weeks));
  if (!plant.frostSensitive) return date;
  const frost = lastFrostDate({ lastFrost }, Number(date.slice(0, 4)));
  const afterFrost = isoDate(addWeeks(parseISO(weekStart(frost)), 1));
  return date < afterFrost ? afterFrost : date;
}

/** „2 Pflanzungen in „Hochbeet Süd“ und „Balkon“ stammen …“, or nothing without plantings. */
export function linkedPlantingsText(
  plantings: SowingWithPlantings['plantings'],
  bedName: (bedId: string) => string,
  language: Language,
): string | undefined {
  if (plantings.length === 0) return undefined;
  const t = i18n.getFixedT(language, 'sowings');
  const beds = [...new Set(plantings.map((p) => bedName(p.bedId)))].map((name) =>
    t('quoted', { name }),
  );
  const where = new Intl.ListFormat(intlLocale(language), { type: 'conjunction' }).format(beds);
  return t('deleteDialog.linked', { count: plantings.length, beds: where });
}

/** A batch the editor offers for planting out, with its plant and how many are free. */
export interface AvailableSowing {
  item: SowingWithPlantings;
  plant: Plant;
  free: number;
}

/** What the editor's preview needs of an offered batch. */
export const previewSowing = ({ item, free }: AvailableSowing): PreviewSowing => ({
  id: item.sowing.id,
  sowDate: item.sowing.sowDate,
  free,
});

/**
 * Batches with free seedlings for the week shown: not done, sown before that week and with
 * more alive than already planned; by sowing week.
 */
export function availableSowings(
  sowings: readonly SowingWithPlantings[],
  plants: readonly Plant[],
  week: string,
): AvailableSowing[] {
  return sowings
    .flatMap((item) => {
      const plant = plants.find((p) => p.id === item.sowing.plantId);
      const { free } = stockOf(item, plants);
      return plant &&
        free !== undefined &&
        free > 0 &&
        item.sowing.stage !== 'DONE' &&
        item.sowing.sowDate < week
        ? [{ item, plant, free }]
        : [];
    })
    .sort((a, b) => a.item.sowing.sowDate.localeCompare(b.item.sowing.sowDate));
}

/**
 * Where a planting's seedlings come from, e.g. „Aus der Anzucht vom 14. – 20. September
 * 2026, 6 von 18“ (before germination of the seeds planned or sown); undefined without a
 * batch or for a deleted one.
 */
export function originText(
  planting: Planting,
  sowings: readonly SowingWithPlantings[],
  plant: Pick<Plant, 'spacingInRowCm'>,
  language: Language,
): string | undefined {
  const item = sowings.find((s) => s.sowing.id === planting.sowingId);
  if (!item) return undefined;
  return i18n.getFixedT(language, 'sowings')('origin', {
    range: formatWeek(item.sowing.sowDate).range,
    planted: plantCount(planting, plant),
    stock: batchStock(item.sowing),
  });
}
