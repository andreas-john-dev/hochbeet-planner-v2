import type {
  Bed,
  Plant,
  Planting,
  SowingBatch,
  SowingBatchFields,
  SowingWithPlantings,
} from '@hochbeet/contracts';
import { formatWeek, plantCount } from '@hochbeet/garden-rules';
import { addWeeks, formatISO, parseISO } from 'date-fns';
import { i18n } from './i18n';
import type { Language } from './language';
import { defaultTransplantDate, fieldsOf, hasSeedlings } from './sowings';

/** Tasks at a batch, checked off on the card. */
export type SowingTaskKind = 'SOW' | 'PRICK_OUT' | 'HARDEN';
/** Tasks in a bed, opened in the editor. */
export type BedTaskKind = 'PLANT_OUT' | 'DIRECT_SOW' | 'SET_PLANTS';

export interface SowingTask {
  kind: SowingTaskKind;
  key: string;
  plant: Plant;
  sowing: SowingBatch;
  /** Monday of the first week the task shows. */
  since: string;
  /** Monday of the week it belongs to: sowing, pricking out or planting out. */
  date: string;
  /** Should have been done before the week. */
  overdue: boolean;
}

export interface BedTask {
  kind: BedTaskKind;
  key: string;
  bed: Bed;
  /** Monday of the week, which is when the plantings start. */
  since: string;
  /** Plants and how many of each, by name. */
  items: { plant: Plant; count: number }[];
  plantings: Planting[];
}

export type WeeklyTask = SowingTask | BedTask;

export const isSowingTask = (task: WeeklyTask): task is SowingTask =>
  task.kind === 'SOW' || task.kind === 'PRICK_OUT' || task.kind === 'HARDEN';

export interface WeeklyTaskData {
  beds: readonly Bed[];
  plantings: readonly Planting[];
  sowings: readonly SowingWithPlantings[];
  plants: readonly Plant[];
  /** The user's last frost (`MM-DD`) for when frost sensitive seedlings may go out. */
  lastFrost: string;
}

/** Hardening off starts this many weeks before planting out. */
export const HARDEN_WEEKS = 2;

const isoDate = (date: Date) => formatISO(date, { representation: 'date' });
const plusWeeks = (monday: string, weeks: number) => isoDate(addWeeks(parseISO(monday), weeks));

/** The week after `week`, for „Nächste Woche“. */
export const nextWeek = (week: string) => plusWeeks(week, 1);

/**
 * When the seedlings of a batch go out: the earliest linked planting, else the planned date,
 * else sowing plus the longest raising time (after the last frost for frost sensitive plants).
 */
function transplantDateOf(item: SowingWithPlantings, plant: Plant, lastFrost: string) {
  const earliest = item.plantings.map((p) => p.startDate).sort()[0];
  return (
    earliest ??
    item.sowing.plannedTransplantDate ??
    defaultTransplantDate(plant, item.sowing.sowDate, lastFrost)
  );
}

function sowingTasks(week: string, item: SowingWithPlantings, plant: Plant, lastFrost: string) {
  const { sowing } = item;
  const task = (kind: SowingTaskKind, since: string, date: string, overdue: boolean) => ({
    kind,
    key: `${kind}:${sowing.id}`,
    plant,
    sowing,
    since,
    date,
    overdue,
  });
  const tasks: SowingTask[] = [];
  if (sowing.stage === 'PLANNED' && sowing.sowDate <= week) {
    tasks.push(task('SOW', sowing.sowDate, sowing.sowDate, sowing.sowDate < week));
  }
  const prickOut = plant.sowing?.prickOutWeeks;
  if (sowing.stage === 'GERMINATED' && prickOut !== undefined) {
    const due = plusWeeks(sowing.sowDate, prickOut);
    if (due <= week) tasks.push(task('PRICK_OUT', due, due, due < week));
  }
  // Hardening off once the seeds are in the soil; planned ones get „Aussäen“ first.
  if (sowing.stage === 'SOWN' || sowing.stage === 'GERMINATED' || sowing.stage === 'PRICKED') {
    const out = transplantDateOf(item, plant, lastFrost);
    const since = out && plusWeeks(out, -HARDEN_WEEKS);
    // Due one to two weeks before planting out, overdue from that week on.
    if (out && since && since <= week) tasks.push(task('HARDEN', since, out, out <= week));
  }
  return tasks;
}

const BED_TASK_ORDER: readonly BedTaskKind[] = ['PLANT_OUT', 'DIRECT_SOW', 'SET_PLANTS'];

function bedTaskKind(planting: Planting, batchIds: ReadonlySet<string>): BedTaskKind {
  if (planting.origin === 'DIRECT_SOW') return 'DIRECT_SOW';
  return planting.sowingId !== undefined && batchIds.has(planting.sowingId)
    ? 'PLANT_OUT'
    : 'SET_PLANTS';
}

/**
 * What to do in `week` (a Monday), never stored: at the batches sowing, pricking out and
 * hardening off, including those already overdue; in the beds per bed what goes in that
 * week, from a batch, sown directly or as seedlings to buy. Overdue tasks first, then the
 * batch tasks by week and name, then the bed tasks by bed.
 */
export function weeklyTasks(
  week: string,
  { beds, plantings, sowings, plants, lastFrost }: WeeklyTaskData,
): WeeklyTask[] {
  const plantOf = (id: string) => plants.find((p) => p.id === id);
  const atBatches = sowings
    .flatMap((item) => {
      const plant = plantOf(item.sowing.plantId);
      return plant ? sowingTasks(week, item, plant, lastFrost) : [];
    })
    .sort(
      (a, b) =>
        Number(b.overdue) - Number(a.overdue) ||
        a.date.localeCompare(b.date) ||
        a.plant.name.localeCompare(b.plant.name, 'de') ||
        a.key.localeCompare(b.key),
    );

  const batchIds = new Set(sowings.map((s) => s.sowing.id));
  const inBeds = new Map<string, BedTask>();
  for (const planting of plantings) {
    if (planting.startDate !== week) continue;
    // Removed in its first week: never in the bed.
    if (planting.removedDate !== null && planting.removedDate <= planting.startDate) continue;
    const bed = beds.find((b) => b.id === planting.bedId);
    const plant = plantOf(planting.plantId);
    if (!bed || !plant) continue;
    const kind = bedTaskKind(planting, batchIds);
    const key = `${kind}:${bed.id}`;
    const task = inBeds.get(key) ?? { kind, key, bed, since: week, items: [], plantings: [] };
    const item = task.items.find((i) => i.plant.id === plant.id);
    const count = plantCount(planting, plant);
    if (item) item.count += count;
    else task.items.push({ plant, count });
    task.plantings.push(planting);
    inBeds.set(key, task);
  }
  const bedTasks = [...inBeds.values()]
    .map((task) => ({
      ...task,
      items: [...task.items].sort((a, b) => a.plant.name.localeCompare(b.plant.name, 'de')),
    }))
    .sort(
      (a, b) =>
        beds.indexOf(a.bed) - beds.indexOf(b.bed) ||
        BED_TASK_ORDER.indexOf(a.kind) - BED_TASK_ORDER.indexOf(b.kind),
    );

  return [...atBatches, ...bedTasks];
}

/** Only what comes up in `week` itself, for the view of the next week. */
export const newTasks = (tasks: readonly WeeklyTask[], week: string) =>
  tasks.filter((task) => task.since === week);

/** The batch after checking the task off: sown, pricked out or hardening off. */
export function taskDone(task: SowingTask): SowingBatchFields {
  const fields = fieldsOf(task.sowing);
  switch (task.kind) {
    case 'SOW':
      return { ...fields, stage: 'SOWN' };
    case 'PRICK_OUT':
      return { ...fields, stage: 'PRICKED' };
    case 'HARDEN':
      // Skipping germination: the stock starts at the sown amount, as on germinating.
      return {
        ...fields,
        stage: 'HARDENING',
        ...(hasSeedlings(task.sowing.stage) ? {} : { aliveCount: task.sowing.sownCount }),
      };
  }
}

const count = (items: BedTask['items'], language: Language) => {
  const t = i18n.getFixedT(language, 'sowings');
  return items
    .map(({ plant, count: n }) => t('tasks.item', { count: n, plant: plant.name }))
    .join(', ');
};

/** The task in a few words, e.g. „Tomate aussäen“ or „Auspflanzen in „Hochbeet Süd““. */
export function taskTitle(task: WeeklyTask, language: Language): string {
  const t = i18n.getFixedT(language, 'sowings');
  if (isSowingTask(task)) return t(`tasks.${task.kind}`, { plant: task.plant.name });
  return t(`tasks.${task.kind}`, { bed: t('quoted', { name: task.bed.name }) });
}

/** What the task is about: the amount and week of a batch, the plants of a bed. */
export function taskDetail(task: WeeklyTask, language: Language): string {
  const t = i18n.getFixedT(language, 'sowings');
  if (!isSowingTask(task)) {
    return task.kind === 'SET_PLANTS'
      ? t('tasks.buySeedlings', { items: count(task.items, language) })
      : count(task.items, language);
  }
  const { sowing, plant } = task;
  const week = formatWeek(task.date).week;
  switch (task.kind) {
    case 'SOW':
      return t('tasks.sowDetail', { count: sowing.sownCount, week });
    case 'PRICK_OUT':
      return t('tasks.prickOutDetail', {
        week: formatWeek(sowing.sowDate).week,
        count: plant.sowing?.prickOutWeeks ?? 0,
      });
    case 'HARDEN':
      return t('tasks.hardenDetail', { week });
  }
}
