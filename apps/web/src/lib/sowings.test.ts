import { seedPlants } from '@hochbeet/catalog-seed';
import type { SowingBatch, SowingWithPlantings } from '@hochbeet/contracts';
import { describe, expect, it } from 'vitest';
import {
  advance,
  availableSowings,
  complete,
  defaultStage,
  defaultTransplantDate,
  filterSowings,
  germinationText,
  groupByYear,
  linkedPlantingsText,
  nextStage,
  originText,
  plantsForSowing,
  stockOf,
  stockText,
  weekText,
  withAlive,
} from './sowings';

const seed = (name: string) => {
  const found = seedPlants.find((p) => p.name === name);
  if (!found) throw new Error(name);
  return found;
};
const lettuce = seed('Kopfsalat'); // 25 cm apart
const tomato = seed('Tomate');

const batch = (id: string, sowDate: string, extra: Partial<SowingBatch> = {}): SowingBatch => ({
  id,
  plantId: lettuce.id,
  sowDate,
  sownCount: 24,
  aliveCount: 18,
  stage: 'PRICKED',
  ...extra,
});
const item = (
  sowing: SowingBatch,
  plantings: SowingWithPlantings['plantings'] = [],
): SowingWithPlantings => ({ sowing, plantings });
const row = (id: string, lengthCm: number) =>
  ({ id, bedId: 'bed', kind: 'ROW', lengthCm, startDate: '2026-05-04' }) as const;

describe('stages', () => {
  it('moves on until hardening off; done only by completing', () => {
    expect(nextStage('PLANNED')).toBe('SOWN');
    expect(nextStage('PRICKED')).toBe('HARDENING');
    expect(nextStage('HARDENING')).toBeUndefined();
    expect(nextStage('DONE')).toBeUndefined();
  });

  it('starts the stock at the sown amount on germination', () => {
    const sown = batch('a', '2026-03-09', { stage: 'SOWN', aliveCount: 0 });
    expect(advance(sown)).toMatchObject({ stage: 'GERMINATED', aliveCount: 24 });
    expect(advance(batch('a', '2026-03-09'))).toMatchObject({ stage: 'HARDENING', aliveCount: 18 });
    expect(advance(batch('a', '2026-03-09'))).not.toHaveProperty('id');
  });

  it('completes with nothing left and keeps the stock within bounds', () => {
    expect(complete(batch('a', '2026-03-09'))).toMatchObject({ stage: 'DONE', aliveCount: 0 });
    expect(withAlive(batch('a', '2026-03-09'), -1).aliveCount).toBe(0);
    expect(withAlive(batch('a', '2026-03-09'), 17).aliveCount).toBe(17);
    expect(withAlive(batch('a', '2026-03-09'), 10_000).aliveCount).toBe(9999);
  });
});

describe('list', () => {
  const list = [
    item(batch('c', '2026-04-06', { stage: 'DONE' })),
    item(batch('b', '2025-03-10')),
    item(batch('a', '2026-03-09')),
    item(batch('d', '2026-03-09', { stage: 'PLANNED' })),
  ];
  const ids = (items: SowingWithPlantings[]) => items.map((i) => i.sowing.id);

  it('filters active, done and all batches', () => {
    expect(ids(filterSowings(list, 'active'))).toEqual(['b', 'a', 'd']);
    expect(ids(filterSowings(list, 'done'))).toEqual(['c']);
    expect(filterSowings(list, 'all')).toHaveLength(4);
  });

  it('groups by year, newest first, and sorts by sowing week within a year', () => {
    expect(groupByYear(list).map((g) => [g.year, ids(g.sowings)])).toEqual([
      [2026, ['a', 'd', 'c']],
      [2025, ['b']],
    ]);
    expect(groupByYear([])).toEqual([]);
  });
});

describe('stock', () => {
  it('counts alive, planned over all linked plantings and free', () => {
    // Rows of 100 and 50 cm with 25 cm spacing: 5 + 3 plants, and a single one.
    const linked = item(batch('a', '2026-03-09'), [
      row('r1', 100),
      row('r2', 50),
      { id: 's1', bedId: 'other', kind: 'SINGLE', startDate: '2026-05-04' },
    ]);
    const stock = stockOf(linked, seedPlants);
    expect(stock).toEqual({ alive: 18, planned: 9, free: 9 });
    expect(stockText(linked.sowing, stock)).toBe('lebend 18 · verplant 9 · frei 9');
  });

  it('shows more planned than alive as a negative free amount', () => {
    const tight = item(batch('a', '2026-03-09', { aliveCount: 4 }), [row('r1', 100)]);
    expect(stockText(tight.sowing, stockOf(tight, seedPlants))).toBe(
      'lebend 4 · verplant 5 · frei −1',
    );
  });

  it('cannot count rows of unknown plants', () => {
    const unknown = item(batch('a', '2026-03-09', { plantId: 'gone' }), [row('r1', 100)]);
    const stock = stockOf(unknown, seedPlants);
    expect(stock).toEqual({ alive: 18, planned: undefined, free: undefined });
    expect(stockText(unknown.sowing, stock)).toBe('lebend 18 · verplant – · frei –');
  });

  it('names seeds before germination and the germination rate after it', () => {
    const sown = batch('a', '2026-03-09', { stage: 'SOWN', aliveCount: 0 });
    expect(stockText(sown, stockOf(item(sown), seedPlants))).toBe('24 gesät');
    const planned = { ...sown, stage: 'PLANNED' as const };
    expect(stockText(planned, stockOf(item(planned, [row('r1', 50)]), seedPlants))).toBe(
      '24 geplant · verplant 3',
    );
    expect(germinationText({ ...sown, stage: 'GERMINATED', aliveCount: 18 })).toBe(
      '18 von 24 gekeimt',
    );
    expect(germinationText(batch('a', '2026-03-09'))).toBeUndefined();
  });
});

describe('new batch', () => {
  it('lists plants raised indoors first', () => {
    const names = plantsForSowing([seed('Möhre'), tomato, lettuce, seed('Erdbeere')]).map(
      (p) => p.name,
    );
    // Kopfsalat and Tomate can be raised; Möhre is sown directly, Erdbeere has no details.
    expect(names).toEqual(['Kopfsalat', 'Tomate', 'Erdbeere', 'Möhre']);
  });

  it('plans batches of later weeks and counts this week as sown', () => {
    const today = new Date(2026, 9, 7); // Wednesday, KW 41
    expect(defaultStage('2026-10-05', today)).toBe('SOWN');
    expect(defaultStage('2026-10-12', today)).toBe('PLANNED');
  });

  it('plants out after the longest raising time, frost sensitive ones after the frost', () => {
    // Kopfsalat: 3–4 weeks, not frost sensitive.
    expect(defaultTransplantDate(lettuce, '2026-03-09', '05-15')).toBe('2026-04-06');
    // Tomate: 13 weeks from 2 February is 4 May, before the frost on Friday 15 May.
    expect(defaultTransplantDate(tomato, '2026-02-02', '05-15')).toBe('2026-05-18');
    expect(defaultTransplantDate(tomato, '2026-03-09', '05-15')).toBe('2026-06-08');
    // A later frost moves it on; a frost on a Monday means the Monday after.
    expect(defaultTransplantDate(tomato, '2026-02-02', '05-25')).toBe('2026-06-01');
    // Plants sown directly have no raising time.
    expect(defaultTransplantDate(seed('Möhre'), '2026-03-09', '05-15')).toBeUndefined();
  });

  it('names the week with its days', () => {
    expect(weekText('2026-03-09')).toBe('KW 11 · 9. – 15. März 2026');
  });
});

describe('linked plantings', () => {
  const names: Record<string, string> = { a: 'Hochbeet Süd', b: 'Balkon' };
  const bedName = (id: string) => names[id] ?? 'einem Beet';
  const single = (id: string, bedId: string) =>
    ({ id, bedId, kind: 'SINGLE', startDate: '2026-05-04' }) as const;

  it('names how many plantings come from the batch and where', () => {
    expect(linkedPlantingsText([], bedName)).toBeUndefined();
    expect(linkedPlantingsText([single('1', 'a')], bedName)).toBe(
      '1 Pflanzung in „Hochbeet Süd“ stammt aus dieser Anzucht. Sie bleibt im Beet, nur die Verbindung zur Anzucht geht verloren.',
    );
    expect(
      linkedPlantingsText([single('1', 'a'), single('2', 'b'), single('3', 'a')], bedName),
    ).toMatch(
      /^3 Pflanzungen in „Hochbeet Süd“ und „Balkon“ stammen aus dieser Anzucht\. Sie bleiben/,
    );
  });
});

describe('planting out in the editor', () => {
  const week = '2026-10-05';

  it('offers batches with free seedlings sown before the week', () => {
    const list = [
      item(batch('later', '2026-10-05')),
      item(batch('done', '2026-09-07', { stage: 'DONE' })),
      // 18 alive, 4 rows of 125 cm with 6 plants each: 24 planned, nothing free.
      item(
        batch('full', '2026-09-07'),
        [1, 2, 3, 4].map((n) => row(String(n), 125)),
      ),
      item(batch('free', '2026-09-14'), [row('r', 125)]),
      item(batch('first', '2026-08-31')),
      item(batch('unknown', '2026-08-31', { plantId: 'gone' })),
    ];
    const offered = availableSowings(list, seedPlants, week);
    expect(offered.map((o) => [o.item.sowing.id, o.plant.name, o.free])).toEqual([
      ['first', 'Kopfsalat', 18],
      ['free', 'Kopfsalat', 12],
    ]);
  });

  it('names the batch a planting comes from and its share', () => {
    const sowings = [item(batch('a', '2026-09-14'))];
    const planting = {
      id: 'p',
      bedId: 'bed',
      plantId: lettuce.id,
      origin: 'TRANSPLANT',
      kind: 'ROW',
      orientation: 'V',
      lengthCm: 125,
      x: 0,
      y: 0,
      startDate: week,
      endDate: null,
      removedDate: null,
      sowingId: 'a',
    } as const;
    expect(originText(planting, sowings, lettuce)).toBe(
      'Aus der Anzucht vom 14. – 20. September 2026, 6 von 18',
    );
    expect(originText({ ...planting, sowingId: 'deleted' }, sowings, lettuce)).toBeUndefined();
  });
});
