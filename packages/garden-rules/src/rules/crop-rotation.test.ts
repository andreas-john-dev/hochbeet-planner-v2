import { describe, expect, it } from 'vitest';
import { context, plant, row, single } from '../test-utils';
import { cropRotationRule } from './crop-rotation';

// Values from docs/startkatalog.md.
const radish = plant('radieschen', {
  name: 'Radieschen',
  family: 'Kreuzblütler',
  spacingInRowCm: 5,
  rowSpacingCm: 10,
  lifecycle: { type: 'ANNUAL', cultureWeeks: 5 },
});
const lettuce = plant('kopfsalat', {
  name: 'Kopfsalat',
  family: 'Korbblütler',
  spacingInRowCm: 25,
  rowSpacingCm: 30,
  lifecycle: { type: 'ANNUAL', cultureWeeks: 8 },
});
const kohlrabi = plant('kohlrabi', {
  name: 'Kohlrabi',
  family: 'Kreuzblütler',
  spacingInRowCm: 25,
  rowSpacingCm: 30,
  lifecycle: { type: 'ANNUAL', cultureWeeks: 9 },
});
const plants = [radish, lettuce, kohlrabi];
const run = (plantings: Parameters<typeof context>[1], soilRenewals: string[] = []) =>
  cropRotationRule(context(plants, plantings, { soilRenewals }));

// Radishes 6 – 13 April → end 18 May (5 weeks).
const radishAt = (x: number, y: number, id = 'r') =>
  single(id, 'radieschen', x, y, { startDate: '2026-04-06' });

describe('crop rotation rule', () => {
  it('warns for kohlrabi after radishes on the same spot', () => {
    expect(
      run([radishAt(50, 50), single('k', 'kohlrabi', 50, 50, { startDate: '2026-06-01' })]),
    ).toEqual([
      {
        rule: 'CROP_ROTATION',
        severity: 'WARNING',
        plantingIds: ['k', 'r'],
        period: { start: '2026-06-01', end: '2026-08-03' },
        message:
          'Kohlrabi folgt am selben Platz direkt auf Radieschen (beide Kreuzblütler) ohne Erneuerung der Erde.',
      },
    ]);
  });

  it('warns when the footprints share only some cells', () => {
    // Radish at x 57.5..62.5 overlaps the edge of the kohlrabi (x 37.5..62.5).
    expect(
      run([radishAt(60, 50), single('k', 'kohlrabi', 50, 50, { startDate: '2026-06-01' })]),
    ).toHaveLength(1);
  });

  it('does not warn for radishes, lettuce, kohlrabi: lettuce is the direct predecessor', () => {
    expect(
      run([
        radishAt(50, 50),
        single('s', 'kopfsalat', 50, 50, { startDate: '2026-05-18' }), // until 13 July
        single('k', 'kohlrabi', 50, 50, { startDate: '2026-07-13' }),
      ]),
    ).toEqual([]);
  });

  describe('lettuce covering only part of a radish row', () => {
    // Radish row x 47.5..112.5; lettuce in between covers x 37.5..62.5 only.
    const radishRow = row('r', 'radieschen', 50, 50, 'H', 60, { startDate: '2026-04-06' });
    const lettuceBetween = single('s', 'kopfsalat', 50, 50, { startDate: '2026-05-18' });

    it('does not warn where the lettuce stood', () => {
      expect(
        run([
          radishRow,
          lettuceBetween,
          single('k', 'kohlrabi', 45, 50, { startDate: '2026-07-13' }),
        ]),
      ).toEqual([]);
    });

    it('still warns where only radishes stood', () => {
      const findings = run([
        radishRow,
        lettuceBetween,
        single('k', 'kohlrabi', 100, 50, { startDate: '2026-07-13' }),
      ]);
      expect(findings.map((f) => f.plantingIds)).toEqual([['k', 'r']]);
    });
  });

  it('does not warn when the soil was renewed in between', () => {
    expect(
      run(
        [radishAt(50, 50), single('k', 'kohlrabi', 50, 50, { startDate: '2026-06-01' })],
        ['2026-05-25'],
      ),
    ).toEqual([]);
  });

  it('does not warn across the default renewal on 1 March', () => {
    expect(
      run([
        single('r', 'radieschen', 50, 50, { startDate: '2026-09-07' }),
        single('k', 'kohlrabi', 50, 50, { startDate: '2027-04-05' }),
      ]),
    ).toEqual([]);
  });

  it('ignores plantings of another family', () => {
    expect(
      run([radishAt(50, 50), single('s', 'kopfsalat', 50, 50, { startDate: '2026-06-01' })]),
    ).toEqual([]);
  });

  it('ignores plantings that stand at the same time', () => {
    expect(
      run([radishAt(50, 50), single('k', 'kohlrabi', 50, 50, { startDate: '2026-05-04' })]),
    ).toEqual([]);
  });

  it('works on 5 cm cells: touching footprints in the same cell count, separate cells do not', () => {
    // Kohlrabi x 37.5..62.5. A radish at x 65 (62.5..67.5) only touches it, but both reach
    // into the cell 60..65.
    expect(
      run([radishAt(65, 50), single('k', 'kohlrabi', 50, 50, { startDate: '2026-06-01' })]),
    ).toHaveLength(1);
    // A radish at x 70 (67.5..72.5) only covers cells from 65 on.
    expect(
      run([radishAt(70, 50), single('k', 'kohlrabi', 50, 50, { startDate: '2026-06-01' })]),
    ).toEqual([]);
  });

  it('counts a removed planting from its removal date', () => {
    expect(
      run([
        single('r', 'radieschen', 50, 50, { startDate: '2026-04-06', removedDate: '2026-04-27' }),
        single('k', 'kohlrabi', 50, 50, { startDate: '2026-04-27' }),
      ]),
    ).toHaveLength(1);
  });

  it('compares families ignoring case and surrounding spaces', () => {
    const ownKohlrabi = plant('kohlrabi', { ...kohlrabi, family: ' kreuzblütler ' });
    const findings = cropRotationRule(
      context(
        [radish, ownKohlrabi],
        [radishAt(50, 50), single('k', 'kohlrabi', 50, 50, { startDate: '2026-06-01' })],
      ),
    );
    expect(findings).toHaveLength(1);
  });

  it('is independent of the order of the plantings', () => {
    const plantings = [
      radishAt(50, 50),
      single('k', 'kohlrabi', 50, 50, { startDate: '2026-06-01' }),
    ];
    expect(run([...plantings].reverse())).toEqual(run(plantings));
  });
});
