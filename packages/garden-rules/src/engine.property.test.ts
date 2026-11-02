import type { Plant, Planting, SowingWithPlantings } from '@hochbeet/contracts';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { evaluateBed, evaluateSowings } from './engine';
import { type Footprint, gap } from './geometry';
import { isActiveInWeek } from './time';
import { batch, bed as makeBed, plant as makePlant } from './test-utils';

const bed = makeBed({ widthCm: 200, depthCm: 100 });
const grid = (max: number) => fc.integer({ min: 0, max: max / 5 }).map((n) => n * 5);
/** Mondays between 5 January 2026 and mid 2027. */
const monday = fc
  .integer({ min: 0, max: 80 })
  .map((weeks) => new Date(Date.UTC(2026, 0, 5 + weeks * 7)).toISOString().slice(0, 10));

/** 2 to 6 plants with random spacing, family, feeder, lifecycle and neighbour lists. */
const plantsArb: fc.Arbitrary<Plant[]> = fc.integer({ min: 2, max: 6 }).chain((count) => {
  const ids = Array.from({ length: count }, (_, i) => `p${String(i)}`);
  return fc.tuple(
    ...ids.map((id) =>
      fc
        .record({
          family: fc.constantFrom('Kreuzblütler', 'Korbblütler', 'Doldenblütler'),
          feeder: fc.constantFrom('STARK', 'MITTEL', 'SCHWACH' as const),
          spacingInRowCm: fc.integer({ min: 5, max: 60 }),
          rowSpacingCm: fc.integer({ min: 10, max: 60 }),
          lifecycle: fc.oneof(
            fc
              .integer({ min: 3, max: 20 })
              .map((cultureWeeks) => ({ type: 'ANNUAL' as const, cultureWeeks })),
            fc.constant({ type: 'PERENNIAL' as const }),
          ),
          goodNeighbors: fc.subarray(ids),
          badNeighbors: fc.subarray(ids),
        })
        .map((fields) => makePlant(id, { name: id, ...fields })),
    ),
  );
});

function plantingsArb(plants: Plant[]): fc.Arbitrary<Planting[]> {
  const base = fc.record({
    plantId: fc.constantFrom(...plants.map((p) => p.id)),
    x: grid(200),
    y: grid(100),
    startDate: monday,
    removedAfterWeeks: fc.option(fc.integer({ min: 1, max: 30 })),
    row: fc.option(
      fc.record({
        orientation: fc.constantFrom('H', 'V' as const),
        lengthCm: grid(120).filter((l) => l > 0),
      }),
    ),
  });
  return fc.array(base, { maxLength: 20 }).map((items) =>
    items.map(({ plantId, x, y, startDate, removedAfterWeeks, row }, i): Planting => {
      const removedDate =
        removedAfterWeeks === null
          ? null
          : new Date(Date.parse(startDate) + removedAfterWeeks * 7 * 86_400_000)
              .toISOString()
              .slice(0, 10);
      const common = {
        id: `pl${String(i).padStart(2, '0')}`,
        bedId: 'bed',
        plantId,
        x,
        y,
        origin: 'TRANSPLANT' as const,
        startDate,
        endDate: null,
        removedDate,
      };
      return row ? { ...common, kind: 'ROW', ...row } : { ...common, kind: 'SINGLE' };
    }),
  );
}

const scenario = plantsArb.chain((plants) => fc.tuple(fc.constant(plants), plantingsArb(plants)));

/** The plants raised or sown directly, some frost sensitive. */
function withSowing(plants: Plant[]): fc.Arbitrary<Plant[]> {
  return fc.tuple(
    ...plants.map((p) =>
      fc
        .record({
          min: fc.integer({ min: 1, max: 6 }),
          extra: fc.integer({ min: 0, max: 4 }),
          direct: fc.boolean(),
          frostSensitive: fc.boolean(),
        })
        .map(({ min, extra, direct, frostSensitive }): Plant => ({
          ...p,
          frostSensitive,
          sowing: direct
            ? { method: 'DIRECT', directSowWeeks: { from: 10, to: 20 } }
            : {
                method: 'PRESOW',
                presowWeeks: { from: 10, to: 20 },
                propagationWeeks: { min, max: min + extra },
              },
        })),
    ),
  );
}

/**
 * Plants with sowing details, plantings of which some come from up to 5 batches (also ids of
 * batches that do not exist), and the batches with their linked plantings.
 */
const sowingScenario = scenario.chain(([plants, plantings]) =>
  fc
    .tuple(
      withSowing(plants),
      fc.array(fc.option(fc.integer({ min: 0, max: 5 })), {
        minLength: plantings.length,
        maxLength: plantings.length,
      }),
      fc.array(
        fc.record({
          plantId: fc.constantFrom(...plants.map((p) => p.id)),
          sowDate: monday,
          aliveCount: fc.integer({ min: 0, max: 30 }),
          stage: fc.constantFrom('SOWN', 'GERMINATED', 'HARDENING', 'DONE' as const),
          plannedTransplantDate: fc.option(monday, { nil: undefined }),
        }),
        { maxLength: 5 },
      ),
    )
    .map(([raised, links, batches]) => {
      const linked = plantings.map((p, i): Planting => {
        const k = links[i];
        return k === null || k === undefined ? p : { ...p, sowingId: `s${String(k)}` };
      });
      const sowings: SowingWithPlantings[] = batches.map(({ plannedTransplantDate, ...b }, i) => {
        const id = `s${String(i)}`;
        return batch(
          id,
          b.plantId,
          { ...b, ...(plannedTransplantDate ? { plannedTransplantDate } : {}) },
          linked.filter((p) => p.sowingId === id),
        );
      });
      return [raised, linked, sowings] as const;
    }),
);

/** Deterministic shuffle driven by fast-check's random seed. */
function shuffle<T>(items: readonly T[], seed: number): T[] {
  const result = [...items];
  let state = seed >>> 0 || 1;
  for (let i = result.length - 1; i > 0; i--) {
    state = (state * 1_103_515_245 + 12_345) >>> 0;
    const j = state % (i + 1);
    [result[i], result[j]] = [result[j] as T, result[i] as T];
  }
  return result;
}

describe('rule engine properties', () => {
  it('does not depend on the order of the plantings', () => {
    fc.assert(
      fc.property(scenario, fc.integer(), ([plants, plantings], seed) => {
        expect(evaluateBed(bed, shuffle(plantings, seed), plants)).toEqual(
          evaluateBed(bed, plantings, plants),
        );
      }),
    );
  });

  it('does not depend on the order of the plants', () => {
    fc.assert(
      fc.property(scenario, fc.integer(), ([plants, plantings], seed) => {
        expect(evaluateBed(bed, plantings, shuffle(plants, seed))).toEqual(
          evaluateBed(bed, plantings, plants),
        );
      }),
    );
  });

  it('does not depend on the order of the sowing batches', () => {
    fc.assert(
      fc.property(sowingScenario, fc.integer(), ([plants, plantings, sowings], seed) => {
        expect(evaluateBed(bed, plantings, plants, { sowings: shuffle(sowings, seed) })).toEqual(
          evaluateBed(bed, plantings, plants, { sowings }),
        );
        expect(evaluateSowings(shuffle(sowings, seed), plants)).toEqual(
          evaluateSowings(sowings, plants),
        );
      }),
    );
  });

  it('only finds sowing problems at plantings of existing batches', () => {
    fc.assert(
      fc.property(sowingScenario, ([plants, plantings, sowings]) => {
        const known = new Set(sowings.map((s) => s.sowing.id));
        const fromBatch = new Set(
          plantings.filter((p) => p.sowingId && known.has(p.sowingId)).map((p) => p.id),
        );
        const rules = ['TRANSPLANT_EARLY', 'TRANSPLANT_LATE', 'OVERPLANNED'];
        for (const f of evaluateBed(bed, plantings, plants, { sowings })) {
          if (rules.includes(f.rule))
            expect(f.plantingIds.every((id) => fromBatch.has(id))).toBe(true);
        }
        // Without batches no sowing rule fires.
        expect(evaluateBed(bed, plantings, plants).filter((f) => rules.includes(f.rule))).toEqual(
          [],
        );
      }),
    );
  });

  it('evaluates neighbour lists symmetrically: which side lists a pair does not matter', () => {
    fc.assert(
      fc.property(scenario, ([plants, plantings]) => {
        // Move every relation to the plant with the smaller id, then to the one with the larger id.
        const moveTo = (pick: (a: string, b: string) => string) =>
          plants.map((p) => {
            const collect = (list: 'goodNeighbors' | 'badNeighbors') =>
              plants.flatMap((other) =>
                (other.id === p.id ? [] : [other])
                  .filter(
                    (o) =>
                      (p[list].includes(o.id) || o[list].includes(p.id)) &&
                      pick(p.id, o.id) === p.id,
                  )
                  .map((o) => o.id),
              );
            const self = (list: 'goodNeighbors' | 'badNeighbors') =>
              p[list].includes(p.id) ? [p.id] : [];
            return {
              ...p,
              goodNeighbors: [...self('goodNeighbors'), ...collect('goodNeighbors')],
              badNeighbors: [...self('badNeighbors'), ...collect('badNeighbors')],
            };
          });
        const lower = moveTo((a, b) => (a < b ? a : b));
        const upper = moveTo((a, b) => (a < b ? b : a));
        expect(evaluateBed(bed, plantings, upper)).toEqual(evaluateBed(bed, plantings, lower));
      }),
    );
  });

  it('only returns well-formed findings', () => {
    fc.assert(
      fc.property(scenario, ([plants, plantings]) => {
        const ids = new Set(plantings.map((p) => p.id));
        for (const finding of evaluateBed(bed, plantings, plants)) {
          expect([...finding.plantingIds].sort()).toEqual(finding.plantingIds);
          expect(finding.plantingIds.every((id) => ids.has(id))).toBe(true);
          expect(finding.plantingIds).toHaveLength(finding.rule === 'BED_EDGE' ? 1 : 2);
          if (finding.period.end !== null)
            expect(finding.period.end > finding.period.start).toBe(true);
          expect(finding.message.length).toBeGreaterThan(0);
        }
      }),
    );
  });

  it('filters a week to a subset of the unfiltered findings that apply in that week', () => {
    fc.assert(
      fc.property(scenario, monday, ([plants, plantings], week) => {
        const all = evaluateBed(bed, plantings, plants);
        const filtered = evaluateBed(bed, plantings, plants, { week });
        expect(filtered).toEqual(all.filter((f) => isActiveInWeek(f.period, week)));
      }),
    );
  });

  it('measures gaps symmetrically', () => {
    const footprint: fc.Arbitrary<Footprint> = fc.oneof(
      fc.record({
        kind: fc.constant('circle' as const),
        cx: grid(200),
        cy: grid(100),
        r: fc.integer({ min: 1, max: 60 }).map((n) => n / 2),
      }),
      fc
        .record({
          x0: grid(200),
          y0: grid(100),
          w: fc.integer({ min: 1, max: 100 }),
          h: fc.integer({ min: 1, max: 100 }),
        })
        .map(({ x0, y0, w, h }) => ({ kind: 'strip' as const, x0, y0, x1: x0 + w, y1: y0 + h })),
    );
    fc.assert(
      fc.property(footprint, footprint, (a, b) => {
        expect(gap(a, b)).toBeCloseTo(gap(b, a), 9);
      }),
    );
  });
});
