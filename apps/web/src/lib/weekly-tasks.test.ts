import { seedPlants } from '@hochbeet/catalog-seed';
import type {
  Bed,
  Planting,
  SowingBatch,
  SowingPlanting,
  SowingWithPlantings,
} from '@hochbeet/contracts';
import { describe, expect, it } from 'vitest';
import {
  newTasks,
  nextWeek,
  taskDetail,
  taskDone,
  taskTitle,
  weeklyTasks,
  type SowingTask,
  type WeeklyTask,
  type WeeklyTaskData,
} from './weekly-tasks';

const seed = (name: string) => {
  const found = seedPlants.find((p) => p.name === name);
  if (!found) throw new Error(name);
  return found;
};
// Raised for 7–13 weeks, pricked out after 2 weeks, frost sensitive, 60 cm apart.
const tomato = seed('Tomate');
// Raised for 3–4 weeks, never pricked out, 25 cm apart.
const lettuce = seed('Kopfsalat');
const carrot = seed('Möhre');
const plants = [tomato, lettuce, carrot];

const bed = (id: string, name: string): Bed => ({
  id,
  name,
  widthCm: 200,
  depthCm: 100,
  mainRowDirection: 'V',
  soilRenewals: [],
});
const south = bed('south', 'Hochbeet Süd');
const balcony = bed('balcony', 'Balkon');
const beds = [south, balcony];

const batch = (id: string, plantId: string, extra: Partial<SowingBatch> = {}): SowingBatch => ({
  id,
  plantId,
  sowDate: '2027-03-15',
  sownCount: 8,
  aliveCount: 0,
  stage: 'PLANNED',
  ...extra,
});
const linked = (startDate: string): SowingPlanting => ({
  id: `l${startDate}`,
  bedId: south.id,
  kind: 'SINGLE',
  startDate,
});
const item = (sowing: SowingBatch, plantings: SowingPlanting[] = []): SowingWithPlantings => ({
  sowing,
  plantings,
});

let next = 0;
const planting = (plantId: string, startDate: string, extra: Partial<Planting> = {}): Planting =>
  ({
    id: `p${String(++next)}`,
    bedId: south.id,
    plantId,
    kind: 'SINGLE',
    origin: 'TRANSPLANT',
    x: 0,
    y: 0,
    startDate,
    endDate: null,
    removedDate: null,
    ...extra,
  }) as Planting;

const data = (extra: Partial<WeeklyTaskData>): WeeklyTaskData => ({
  beds,
  plantings: [],
  sowings: [],
  plants,
  lastFrost: '05-15',
  ...extra,
});
const summary = (tasks: WeeklyTask[]) =>
  tasks.map((t) => [
    t.kind,
    taskTitle(t, 'de'),
    taskDetail(t, 'de'),
    'overdue' in t ? t.overdue : '-',
  ]);
const tasksOf = (week: string, extra: Partial<WeeklyTaskData>) =>
  summary(weeklyTasks(week, data(extra)));

describe('sowing', () => {
  const planned = item(batch('s', tomato.id));

  it('is due in the sowing week and overdue after it', () => {
    expect(tasksOf('2027-03-08', { sowings: [planned] })).toEqual([]);
    expect(tasksOf('2027-03-15', { sowings: [planned] })).toEqual([
      ['SOW', 'Tomate aussäen', '8 Samen, geplant für KW 11', false],
    ]);
    expect(tasksOf('2027-03-22', { sowings: [planned] })).toEqual([
      ['SOW', 'Tomate aussäen', '8 Samen, geplant für KW 11', true],
    ]);
  });

  it('is done once sown', () => {
    const sown = item(batch('s', tomato.id, { stage: 'SOWN' }));
    expect(tasksOf('2027-03-15', { sowings: [sown] })).toEqual([]);
  });
});

describe('pricking out', () => {
  const germinated = (plantId: string) =>
    item(batch('s', plantId, { stage: 'GERMINATED', aliveCount: 6 }));

  it('is due the given weeks after sowing, for germinated batches only', () => {
    // Sown in KW 11, pricked out after 2 weeks: KW 13.
    expect(tasksOf('2027-03-22', { sowings: [germinated(tomato.id)] })).toEqual([]);
    expect(tasksOf('2027-03-29', { sowings: [germinated(tomato.id)] })).toEqual([
      ['PRICK_OUT', 'Tomate pikieren', 'Gesät in KW 11, pikieren nach 2 Wochen', false],
    ]);
    expect(
      weeklyTasks('2027-04-05', data({ sowings: [germinated(tomato.id)] })).map((t) => [
        t.kind,
        'overdue' in t && t.overdue,
      ]),
    ).toEqual([['PRICK_OUT', true]]);
    const sown = item(batch('s', tomato.id, { stage: 'SOWN' }));
    expect(tasksOf('2027-03-29', { sowings: [sown] })).toEqual([]);
  });

  it('is never due for plants that are not pricked out', () => {
    expect(tasksOf('2027-06-28', { sowings: [germinated(lettuce.id)] }).map((t) => t[0])).toEqual([
      'HARDEN',
    ]);
  });
});

describe('hardening off', () => {
  const pricked = (extra: Partial<SowingBatch>, plantings: SowingPlanting[] = []) =>
    item(batch('s', tomato.id, { stage: 'PRICKED', aliveCount: 6, ...extra }), plantings);

  it('starts one to two weeks before the earliest linked planting', () => {
    const sowings = [
      pricked({ plannedTransplantDate: '2027-06-07' }, [
        linked('2027-05-31'),
        linked('2027-05-24'),
      ]),
    ];
    expect(tasksOf('2027-05-03', { sowings })).toEqual([]);
    expect(tasksOf('2027-05-10', { sowings })).toEqual([
      ['HARDEN', 'Tomate abhärten', 'Auspflanzen ab KW 21', false],
    ]);
    expect(tasksOf('2027-05-17', { sowings })[0]?.[3]).toBe(false);
    // In the planting week it is overdue.
    expect(tasksOf('2027-05-24', { sowings })[0]?.[3]).toBe(true);
  });

  it('uses the planned date without plantings, else the longest raising time', () => {
    const planned = [pricked({ plannedTransplantDate: '2027-06-07' })];
    expect(tasksOf('2027-05-24', { sowings: planned })).toEqual([
      ['HARDEN', 'Tomate abhärten', 'Auspflanzen ab KW 23', false],
    ]);
    // 13 weeks after KW 11 is KW 24, after the frost: hardening from KW 22.
    const unplanned = [pricked({})];
    expect(tasksOf('2027-05-24', { sowings: unplanned })).toHaveLength(0);
    expect(tasksOf('2027-05-31', { sowings: unplanned })).toEqual([
      ['HARDEN', 'Tomate abhärten', 'Auspflanzen ab KW 24', false],
    ]);
    // A frost late in June moves it on.
    expect(
      tasksOf('2027-05-31', { sowings: unplanned, lastFrost: '06-20' }).map((t) => t[0]),
    ).toEqual([]);
  });

  it('comes for sown to pricked batches, not for planned, hardening or done ones', () => {
    const at = (stage: SowingBatch['stage']) =>
      tasksOf('2027-05-24', {
        sowings: [pricked({ stage, plannedTransplantDate: '2027-06-07' })],
      }).map((t) => t[0]);
    expect(at('SOWN')).toEqual(['HARDEN']);
    // Pricking out of the tomatoes is overdue by then.
    expect(at('GERMINATED')).toEqual(['PRICK_OUT', 'HARDEN']);
    expect(at('PLANNED')).toEqual(['SOW']);
    expect(at('HARDENING')).toEqual([]);
    expect(at('DONE')).toEqual([]);
  });
});

describe('bed tasks', () => {
  const week = '2027-05-24';
  const sowings = [
    item(batch('s', lettuce.id, { stage: 'HARDENING', aliveCount: 10 }), [linked(week)]),
  ];

  it('lists per bed what is planted out, sown directly and bought in the week', () => {
    const plantings = [
      planting(lettuce.id, week, { sowingId: 's' }),
      planting(lettuce.id, week, { sowingId: 's' }),
      planting(carrot.id, week, { origin: 'DIRECT_SOW' }),
      planting(tomato.id, week, { bedId: balcony.id }),
      // A deleted batch counts as none: seedlings to buy.
      planting(lettuce.id, week, { sowingId: 'gone' }),
      // Other weeks and plantings removed in their first week are not part of it.
      planting(tomato.id, '2027-05-31'),
      planting(tomato.id, '2027-05-17'),
      planting(tomato.id, week, { removedDate: week }),
    ];
    expect(tasksOf(week, { plantings, sowings })).toEqual([
      ['PLANT_OUT', 'Auspflanzen in „Hochbeet Süd“', '2 × Kopfsalat', '-'],
      ['DIRECT_SOW', 'Direkt säen in „Hochbeet Süd“', '1 × Möhre', '-'],
      [
        'SET_PLANTS',
        'Pflanzen setzen in „Hochbeet Süd“',
        'Jungpflanzen besorgen: 1 × Kopfsalat',
        '-',
      ],
      ['SET_PLANTS', 'Pflanzen setzen in „Balkon“', 'Jungpflanzen besorgen: 1 × Tomate', '-'],
    ]);
  });

  it('counts the plants of rows and sorts the plants by name', () => {
    // 125 cm of lettuce are 6 plants, 120 cm of tomatoes 3.
    const plantings = [
      planting(tomato.id, week, {
        kind: 'ROW',
        orientation: 'H',
        lengthCm: 120,
      }),
      planting(lettuce.id, week, {
        kind: 'ROW',
        orientation: 'H',
        lengthCm: 125,
      }),
    ];
    expect(tasksOf(week, { plantings })).toEqual([
      [
        'SET_PLANTS',
        'Pflanzen setzen in „Hochbeet Süd“',
        'Jungpflanzen besorgen: 6 × Kopfsalat, 3 × Tomate',
        '-',
      ],
    ]);
  });

  it('skips unknown plants and beds', () => {
    const plantings = [planting('gone', week), planting(tomato.id, week, { bedId: 'gone' })];
    expect(tasksOf(week, { plantings })).toEqual([]);
  });
});

describe('in English', () => {
  const english = (week: string, extra: Partial<WeeklyTaskData>) =>
    weeklyTasks(week, data(extra)).map((t) => [taskTitle(t, 'en'), taskDetail(t, 'en')]);

  it('names the tasks at batches', () => {
    expect(english('2027-03-15', { sowings: [item(batch('s', tomato.id))] })).toEqual([
      ['Sow Tomate', '8 seeds, planned for Week 11'],
    ]);
    const germinated = item(batch('s', tomato.id, { stage: 'GERMINATED', aliveCount: 6 }));
    expect(english('2027-03-29', { sowings: [germinated] })).toEqual([
      ['Prick out Tomate', 'Sown in Week 11, prick out after 2 weeks'],
    ]);
    const sown = item(batch('s', tomato.id, { stage: 'SOWN' }), [linked('2027-05-24')]);
    expect(english('2027-05-10', { sowings: [sown] })).toEqual([
      ['Harden off Tomate', 'Plant out from Week 21'],
    ]);
  });

  it('names the tasks in beds', () => {
    const week = '2027-05-24';
    const sowings = [item(batch('s', lettuce.id, { stage: 'HARDENING' }), [linked(week)])];
    const plantings = [
      planting(lettuce.id, week, { sowingId: 's' }),
      planting(carrot.id, week, { origin: 'DIRECT_SOW' }),
      planting(tomato.id, week, { bedId: balcony.id }),
    ];
    expect(english(week, { plantings, sowings })).toEqual([
      ['Plant out in “Hochbeet Süd”', '1 × Kopfsalat'],
      ['Sow directly in “Hochbeet Süd”', '1 × Möhre'],
      ['Set out plants in “Balkon”', 'Get seedlings: 1 × Tomate'],
    ]);
  });
});

describe('order and weeks', () => {
  it('lists overdue tasks first, then by week and name, then the beds', () => {
    const sowings = [
      item(batch('a', tomato.id, { sowDate: '2027-03-22' })),
      item(batch('b', lettuce.id, { sowDate: '2027-03-22' })),
      item(batch('c', tomato.id, { sowDate: '2027-03-15' })),
      item(batch('d', lettuce.id, { sowDate: '2027-03-01' })),
    ];
    const plantings = [planting(tomato.id, '2027-03-22')];
    expect(
      weeklyTasks('2027-03-22', data({ sowings, plantings })).map((t) =>
        'sowing' in t ? t.sowing.id : t.bed.id,
      ),
    ).toEqual(['d', 'c', 'b', 'a', 'south']);
  });

  it('shows for the next week only what newly comes up there', () => {
    const sowings = [
      item(batch('overdue', tomato.id, { sowDate: '2027-03-08' })),
      item(batch('now', tomato.id, { sowDate: '2027-03-15' })),
      item(batch('later', lettuce.id, { sowDate: '2027-03-22' })),
    ];
    const week = nextWeek('2027-03-15');
    expect(week).toBe('2027-03-22');
    const tasks = weeklyTasks(week, data({ sowings, plantings: [planting(tomato.id, week)] }));
    expect(newTasks(tasks, week).map((t) => t.key)).toEqual(['SOW:later', 'SET_PLANTS:south']);
  });

  it('counts weeks across the turn of the year', () => {
    // 2026 has 53 ISO weeks: KW 53 starts on 28 December.
    const sowings = [item(batch('s', lettuce.id, { sowDate: '2026-12-28' }))];
    expect(nextWeek('2026-12-28')).toBe('2027-01-04');
    expect(tasksOf('2026-12-28', { sowings })).toEqual([
      ['SOW', 'Kopfsalat aussäen', '8 Samen, geplant für KW 53', false],
    ]);
    expect(tasksOf('2027-01-04', { sowings })[0]?.[3]).toBe(true);
  });
});

describe('checking off', () => {
  const task = (kind: SowingTask['kind'], sowing: SowingBatch): SowingTask => ({
    kind,
    key: kind,
    plant: tomato,
    sowing,
    since: sowing.sowDate,
    date: sowing.sowDate,
    overdue: false,
  });

  it('moves the batch on to the stage the task leads to', () => {
    expect(taskDone(task('SOW', batch('s', tomato.id)))).toMatchObject({ stage: 'SOWN' });
    const germinated = batch('s', tomato.id, { stage: 'GERMINATED', aliveCount: 6 });
    expect(taskDone(task('PRICK_OUT', germinated))).toMatchObject({
      stage: 'PRICKED',
      aliveCount: 6,
    });
    expect(taskDone(task('HARDEN', germinated))).toMatchObject({
      stage: 'HARDENING',
      aliveCount: 6,
    });
    expect(taskDone(task('SOW', batch('s', tomato.id)))).not.toHaveProperty('id');
  });

  it('starts the stock at the sown amount when hardening off skips germination', () => {
    const sown = batch('s', tomato.id, { stage: 'SOWN', sownCount: 8, aliveCount: 0 });
    expect(taskDone(task('HARDEN', sown))).toMatchObject({ stage: 'HARDENING', aliveCount: 8 });
  });
});
