import { seedPlants } from '@hochbeet/catalog-seed';
import type { Bed, Planting, SowingWithPlantings } from '@hochbeet/contracts';
import { describe, expect, it } from 'vitest';
import type { ApiFetch } from './api';
import { batchFor, buildSowingPlan, saveSowingPlan, sowWeekFor, withReserve } from './sowing-plan';

const seed = (name: string) => {
  const found = seedPlants.find((p) => p.name === name);
  if (!found) throw new Error(name);
  return found;
};
// Raised in KW 11–16 for 7–13 weeks, 60 cm apart.
const tomato = seed('Tomate');
// Raised in KW 10–30 for 3–4 weeks, 25 cm apart; can also be sown directly.
const lettuce = seed('Kopfsalat');
// Sown directly only.
const carrot = seed('Möhre');
const plants = [tomato, lettuce, carrot];

// Wednesday of the week starting Monday 5 October 2026.
const today = new Date(2026, 9, 7);

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

let next = 0;
const single = (plantId: string, startDate: string, extra: Partial<Planting> = {}): Planting =>
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
/** A row of `lengthCm`; 275 cm of lettuce are 12 plants. */
const row = (plantId: string, startDate: string, lengthCm: number): Planting => ({
  id: `p${String(++next)}`,
  bedId: south.id,
  plantId,
  kind: 'ROW',
  orientation: 'H',
  lengthCm,
  origin: 'TRANSPLANT',
  x: 0,
  y: 0,
  startDate,
  endDate: null,
  removedDate: null,
});

const batch = (id: string): SowingWithPlantings => ({
  sowing: {
    id,
    plantId: tomato.id,
    sowDate: '2027-03-15',
    sownCount: 6,
    aliveCount: 0,
    stage: 'PLANNED',
  },
  plantings: [],
});

const plan = (plantings: Planting[], sowings: SowingWithPlantings[] = []) =>
  buildSowingPlan(beds, plantings, plants, sowings, { today });

describe('withReserve', () => {
  it('adds 30 %, rounded up, at least one', () => {
    expect(withReserve(1)).toBe(2);
    expect(withReserve(3)).toBe(4);
    expect(withReserve(4)).toBe(6);
    // 10 × 1.3 is 13, not 14 because of floating point.
    expect(withReserve(10)).toBe(13);
    expect(withReserve(12)).toBe(16);
    expect(withReserve(5, 0)).toBe(6);
    expect(withReserve(10, 0.5)).toBe(15);
  });

  it('stays within what a batch holds', () => {
    expect(withReserve(9000)).toBe(9999);
  });
});

describe('sowWeekFor', () => {
  const thisWeek = '2026-10-05';

  it('sows the longest raising time before, moved into the raising window', () => {
    // Planted out in KW 20: 13 weeks before is KW 7, the window starts in KW 11 (9 weeks).
    expect(sowWeekFor(tomato, '2027-05-17', thisWeek)).toEqual({
      sowDate: '2027-03-15',
      tooLate: false,
    });
    // Lettuce: 4 weeks before KW 20 is KW 16, inside its window.
    expect(sowWeekFor(lettuce, '2027-05-17', thisWeek)).toEqual({
      sowDate: '2027-04-19',
      tooLate: false,
    });
  });

  it('keeps the longest raising time when no week fits the window', () => {
    // Planted out in KW 14: sowing in KW 1–7, all before the window.
    expect(sowWeekFor(tomato, '2027-04-05', thisWeek)).toEqual({
      sowDate: '2027-01-04',
      tooLate: false,
    });
  });

  it('skips weeks already past and marks the row when every week is past', () => {
    // 4 weeks before is past, 3 weeks before is this week.
    expect(sowWeekFor(lettuce, '2026-10-26', thisWeek)).toEqual({
      sowDate: thisWeek,
      tooLate: false,
    });
    // 3 and 4 weeks before are both past: too late, sow this week at the earliest.
    expect(sowWeekFor(lettuce, '2026-10-19', thisWeek)).toEqual({
      sowDate: thisWeek,
      tooLate: true,
    });
  });

  it('has no week for plants without raising time', () => {
    expect(sowWeekFor(carrot, '2027-05-17', thisWeek)).toBeUndefined();
  });
});

describe('buildSowingPlan', () => {
  it('groups by plant and sowing week, with the reserve and the beds', () => {
    const tomatoes = [
      single(tomato.id, '2027-05-17'),
      single(tomato.id, '2027-05-17'),
      single(tomato.id, '2027-05-24', { bedId: balcony.id }),
      single(tomato.id, '2027-05-17'),
    ];
    const lettuces = row(lettuce.id, '2027-05-17', 275);
    const rows = plan([...tomatoes, lettuces]);

    expect(
      rows.map((r) => [r.plant.name, r.sowDate, r.transplantDate, r.needed, r.withReserve]),
    ).toEqual([
      // KW 21 is 10 weeks after KW 11 as well, so all tomatoes share one week.
      ['Tomate', '2027-03-15', '2027-05-17', 4, 6],
      ['Kopfsalat', '2027-04-19', '2027-05-17', 12, 16],
    ]);
    expect(rows[0]?.plantings.map((p) => p.id)).toEqual(tomatoes.map((p) => p.id));
    // Beds in the order of the bed list.
    expect(rows[0]?.beds.map((b) => b.name)).toEqual(['Hochbeet Süd', 'Balkon']);
    expect(rows[1]?.beds.map((b) => b.name)).toEqual(['Hochbeet Süd']);
    expect(rows.every((r) => !r.tooLate)).toBe(true);
  });

  it('makes a row per sowing week of the same plant', () => {
    const rows = plan([single(lettuce.id, '2027-05-17'), single(lettuce.id, '2027-06-14')]);
    expect(rows.map((r) => [r.sowDate, r.needed, r.withReserve])).toEqual([
      ['2027-04-19', 1, 2],
      ['2027-05-17', 1, 2],
    ]);
  });

  it('uses the given reserve', () => {
    const rows = buildSowingPlan(beds, [row(lettuce.id, '2027-05-17', 275)], plants, [], {
      today,
      reserve: 0.5,
    });
    expect(rows[0]?.withReserve).toBe(18);
  });

  it('marks rows too late to raise', () => {
    const rows = plan([single(lettuce.id, '2026-10-19')]);
    expect(rows).toEqual([
      expect.objectContaining({
        sowDate: '2026-10-05',
        transplantDate: '2026-10-19',
        tooLate: true,
      }),
    ]);
  });

  it('ignores linked, direct sown, past and removed plantings', () => {
    const rows = plan(
      [
        single(tomato.id, '2027-05-17', { sowingId: 'existing' }),
        single(lettuce.id, '2027-05-17', { origin: 'DIRECT_SOW' }),
        // Started last week.
        single(lettuce.id, '2026-09-28'),
        // Removed in its first week.
        single(lettuce.id, '2027-05-17', { removedDate: '2027-05-17' }),
      ],
      [batch('existing')],
    );
    expect(rows).toEqual([]);
  });

  it('plans plantings of a deleted batch again', () => {
    const rows = plan([single(tomato.id, '2027-05-17', { sowingId: 'deleted' })], [batch('other')]);
    expect(rows.map((r) => [r.plant.name, r.needed])).toEqual([['Tomate', 1]]);
  });

  it('leaves out plants that are only sown directly or have no sowing details', () => {
    const noSowing = { ...tomato, id: 'own', name: 'Eigene', sowing: undefined };
    const rows = buildSowingPlan(
      beds,
      [
        single(carrot.id, '2027-05-17'),
        single('own', '2027-05-17'),
        single('unknown', '2027-05-17'),
      ],
      [...plants, noSowing],
      [],
      { today },
    );
    expect(rows).toEqual([]);
  });
});

describe('batchFor', () => {
  it('plans the batch with the seeds to sow and the earliest planting week', () => {
    const [first] = plan([single(tomato.id, '2027-05-17')]);
    if (!first) throw new Error('no row');
    expect(batchFor(first, 3)).toEqual({
      plantId: tomato.id,
      sowDate: '2027-03-15',
      sownCount: 3,
      aliveCount: 0,
      stage: 'PLANNED',
      plannedTransplantDate: '2027-05-17',
    });
  });

  it('leaves out the planting week when it is the sowing week', () => {
    const [late] = buildSowingPlan(beds, [single(lettuce.id, '2026-10-05')], plants, [], {
      today,
    });
    if (!late) throw new Error('no row');
    expect(batchFor(late, 2)).not.toHaveProperty('plannedTransplantDate');
  });
});

describe('saveSowingPlan', () => {
  /** A fake API that records calls and fails the requests in `failing` once. */
  function fakeApi(failing: Set<string>) {
    const calls: { method: string; path: string; body: unknown }[] = [];
    let batches = 0;
    const api = ((path: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const raw = init?.body;
      const body: unknown = typeof raw === 'string' ? JSON.parse(raw) : undefined;
      calls.push({ method, path, body });
      const call = `${method} ${path}`;
      if (failing.delete(call)) return Promise.reject(new Error(`failed: ${call}`));
      return Promise.resolve(method === 'POST' ? { id: `b${String(++batches)}` } : body);
    }) as ApiFetch;
    return { api, calls };
  }

  it('creates a batch per row and links its plantings', async () => {
    const rows = plan([single(tomato.id, '2027-05-17'), row(lettuce.id, '2027-05-17', 275)]);
    const { api, calls } = fakeApi(new Set());
    const created = new Map<string, string>();

    const failed = await saveSowingPlan(
      api,
      rows.map((r) => ({ row: r, count: r.withReserve })),
      created,
    );

    expect(failed.size).toBe(0);
    expect(calls.filter((c) => c.method === 'POST').map((c) => c.body)).toEqual([
      expect.objectContaining({ plantId: tomato.id, sownCount: 2, stage: 'PLANNED' }),
      expect.objectContaining({ plantId: lettuce.id, sownCount: 16, stage: 'PLANNED' }),
    ]);
    const puts = calls.filter((c) => c.method === 'PUT');
    expect(puts.map((c) => [c.path, (c.body as { sowingId: string }).sowingId])).toEqual([
      [`/api/garden/beds/south/plantings/${rows[0]?.plantings[0]?.id ?? ''}`, 'b1'],
      [`/api/garden/beds/south/plantings/${rows[1]?.plantings[0]?.id ?? ''}`, 'b2'],
    ]);
    // The whole planting goes along, without id and bedId.
    expect(puts[0]?.body).not.toHaveProperty('id');
    expect(puts[0]?.body).toEqual(expect.objectContaining({ startDate: '2027-05-17', x: 0 }));
  });

  it('reports failed rows and reuses their batch on a retry', async () => {
    const tomatoes = [single(tomato.id, '2027-05-17'), single(tomato.id, '2027-05-17')];
    const lettuces = single(lettuce.id, '2027-05-17');
    const rows = plan([...tomatoes, lettuces]);
    const linkSecond = `PUT /api/garden/beds/south/plantings/${tomatoes[1]?.id ?? ''}`;
    const { api, calls } = fakeApi(new Set([linkSecond, 'POST /api/garden/sowings']));
    const created = new Map<string, string>();
    const chosen = rows.map((r) => ({ row: r, count: r.withReserve }));

    // The first POST (tomatoes) fails, so the tomato row has no batch yet.
    const first = await saveSowingPlan(api, chosen, created);
    expect([...first.keys()]).toEqual([rows[0]?.key]);
    expect(first.get(rows[0]?.key ?? '')).toEqual(new Error('failed: POST /api/garden/sowings'));
    expect([...created.keys()]).toEqual([rows[1]?.key]);

    // The retry creates the tomato batch, but linking the second tomato fails.
    const tomatoRow = chosen.slice(0, 1);
    const second = await saveSowingPlan(api, tomatoRow, created);
    expect([...second.keys()]).toEqual([rows[0]?.key]);
    expect(created.size).toBe(2);

    // A further retry only links: no batch is created twice.
    calls.length = 0;
    const third = await saveSowingPlan(api, tomatoRow, created);
    expect(third.size).toBe(0);
    expect(calls.every((c) => c.method === 'PUT')).toBe(true);
  });
});
