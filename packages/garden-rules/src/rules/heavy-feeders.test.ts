import { describe, expect, it } from 'vitest';
import { context, plant, row, single } from '../test-utils';
import { heavyFeedersRule } from './heavy-feeders';

// Values from docs/startkatalog.md.
const broccoli = plant('brokkoli', {
  name: 'Brokkoli',
  feeder: 'STARK',
  spacingInRowCm: 50,
  rowSpacingCm: 50,
});
const celery = plant('sellerie', {
  name: 'Staudensellerie',
  feeder: 'STARK',
  spacingInRowCm: 40,
  rowSpacingCm: 40,
});
const kohlrabi = plant('kohlrabi', {
  name: 'Kohlrabi',
  feeder: 'MITTEL',
  spacingInRowCm: 25,
  rowSpacingCm: 30,
});
const plants = [broccoli, celery, kohlrabi];

/** 2 × 1 m bed; rows run across it (parallel to the 1 m edge) by default. */
const bed = { widthCm: 200, depthCm: 100, mainRowDirection: 'V' as const };
const run = (plantings: Parameters<typeof context>[1], bedOverrides = {}) =>
  heavyFeedersRule(context(plants, plantings, { ...bed, ...bedOverrides }));

// A V row at x has the strip [x - rowSpacing/2, x + rowSpacing/2] across the bed.
const broccoliRow = row('b', 'brokkoli', 25, 25, 'V', 50); // x 0..50, y 0..100
const celeryRowAt = (gapCm: number) => row('s', 'sellerie', 50 + gapCm + 20, 20, 'V', 60); // x from 50 + gap

describe('heavy feeder rule', () => {
  it('warns for a celery row 20 cm beside a broccoli row across a 2 × 1 m bed', () => {
    expect(run([broccoliRow, celeryRowAt(20)])).toEqual([
      {
        rule: 'HEAVY_FEEDER',
        severity: 'WARNING',
        plantingIds: ['b', 's'],
        period: { start: '2026-05-04', end: '2026-07-27' },
        message:
          'Brokkoli und Staudensellerie sind Starkzehrer und stehen mit 20 cm Lücke nebeneinander (mindestens 30 cm empfohlen).',
      },
    ]);
  });

  it('stops warning at 30 cm gap', () => {
    expect(run([broccoliRow, celeryRowAt(29)])).toHaveLength(1);
    expect(run([broccoliRow, celeryRowAt(30)])).toEqual([]);
  });

  it('allows three broccoli one behind the other in a row', () => {
    // As one row planting (floor(100 / 50) + 1 = 3 plants) …
    expect(run([row('r', 'brokkoli', 25, 0, 'V', 100)])).toEqual([]);
    // … and as three single plants in a line along the row direction.
    expect(
      run(
        [
          single('a', 'brokkoli', 25, 25),
          single('b', 'brokkoli', 25, 75),
          single('c', 'brokkoli', 25, 125),
        ],
        {
          depthCm: 150,
        },
      ),
    ).toEqual([]);
  });

  it('allows a heavy feeder at the head end of a row', () => {
    // Broccoli row y 0..100 (incl. overhang); celery 20 cm beyond its end, in line with it.
    expect(
      run([row('r', 'brokkoli', 25, 25, 'V', 50), single('s', 'sellerie', 25, 140)], {
        depthCm: 200,
      }),
    ).toEqual([]);
  });

  it('warns for single plants side by side across the bed direction', () => {
    // Bed rows run along y (V): x is across. Broccoli at x 0..50 and x 60..110 → 10 cm gap.
    expect(run([single('a', 'brokkoli', 25, 25), single('b', 'brokkoli', 85, 25)])).toHaveLength(1);
  });

  it('uses the bed direction for single plants', () => {
    // Same two plants with rows along x (H): now they stand one behind the other.
    expect(
      run([single('a', 'brokkoli', 25, 25), single('b', 'brokkoli', 85, 25)], {
        mainRowDirection: 'H',
      }),
    ).toEqual([]);
  });

  describe('rows with different orientations', () => {
    // Horizontal broccoli row y 0..50 and a vertical celery row starting 20 cm below it.
    const horizontal = row('h', 'brokkoli', 25, 25, 'H', 100); // x 0..150, y 0..50
    const vertical = row('v', 'sellerie', 70, 90, 'V', 40); // x 50..90, y 70..150

    it('warns when one view sees them side by side', () => {
      // Along the horizontal row (x) they overlap and are 20 cm apart across (y).
      expect(run([horizontal, vertical], { depthCm: 200 }).map((f) => f.plantingIds)).toEqual([
        ['h', 'v'],
      ]);
    });

    it('allows them when neither view sees them side by side', () => {
      // Celery row moved right of the broccoli row's end: behind it in both views.
      const beyondEnd = row('v', 'sellerie', 170, 90, 'V', 40); // x 150..190
      expect(run([horizontal, beyondEnd], { depthCm: 200 })).toEqual([]);
    });
  });

  it('ignores pairs that are not both heavy feeders', () => {
    expect(run([broccoliRow, row('k', 'kohlrabi', 65, 15, 'V', 50)])).toEqual([]);
  });

  it('leaves footprints that overlap on both axes to the spacing rule', () => {
    expect(run([single('a', 'brokkoli', 25, 25), single('b', 'brokkoli', 25, 60)])).toEqual([]);
  });

  it('only compares plantings that are in the bed at the same time', () => {
    expect(
      run([
        row('b', 'brokkoli', 25, 25, 'V', 50, { endDate: '2026-06-01' }),
        row('s', 'sellerie', 90, 20, 'V', 60, { startDate: '2026-06-01' }),
      ]),
    ).toEqual([]);
  });

  it('is independent of the order of the plantings', () => {
    expect(run([celeryRowAt(20), broccoliRow])).toEqual(run([broccoliRow, celeryRowAt(20)]));
  });
});
