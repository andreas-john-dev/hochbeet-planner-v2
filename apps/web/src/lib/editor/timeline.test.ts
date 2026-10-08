import { seedPlants } from '@hochbeet/catalog-seed';
import type { Planting } from '@hochbeet/contracts';
import { describe, expect, it } from 'vitest';
import { ghosts, monthMarks, sliderWeeks } from './timeline';

const plant = (name: string) => {
  const found = seedPlants.find((p) => p.name === name);
  if (!found) throw new Error(name);
  return found;
};

const planting = (id: string, name: string, extra: Partial<Planting>): Planting =>
  ({
    id,
    bedId: '01J9ZQ3W8D6V2K5M7N8P9R0S1A',
    plantId: plant(name).id,
    kind: 'SINGLE',
    x: 50,
    y: 50,
    startDate: '2026-04-06',
    endDate: null,
    removedDate: null,
    ...extra,
  }) as Planting;

const entry = (p: Planting, name: string) => ({ planting: p, plant: plant(name) });

describe('slider weeks', () => {
  it('lists every Monday of the year', () => {
    const weeks = sliderWeeks('2026-10-05');
    expect(weeks).toHaveLength(52);
    expect(weeks[0]).toBe('2026-01-05');
    expect(weeks.at(-1)).toBe('2026-12-28');
  });

  it('includes 1 January when it is a Monday', () => {
    const weeks = sliderWeeks('2029-06-04');
    expect(weeks[0]).toBe('2029-01-01');
    expect(weeks).toHaveLength(53);
  });

  it('labels the months where they start', () => {
    const marks = monthMarks(sliderWeeks('2026-10-05'));
    expect(marks.map((m) => m.label)).toEqual([
      'Jan',
      'Feb',
      'Mär',
      'Apr',
      'Mai',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Okt',
      'Nov',
      'Dez',
    ]);
    expect(marks[0]?.at).toBe(0);
    // April starts with the 14th Monday (6 April).
    expect(marks[3]?.at).toBeCloseTo(13 / 51);
  });
});

describe('ghosts', () => {
  // Lettuce in April, tomato from May at the same place.
  const lettuce = entry(planting('salat', 'Kopfsalat', { endDate: '2026-05-04' }), 'Kopfsalat');
  const tomato = entry(planting('tomate', 'Tomate', { startDate: '2026-05-04' }), 'Tomate');
  const elsewhere = entry(
    planting('fern', 'Tomate', { x: 180, y: 50, startDate: '2026-05-04' }),
    'Tomate',
  );

  it('shows the successor at the same place as a ghost', () => {
    expect(ghosts([lettuce, tomato, elsewhere], '2026-04-13')).toEqual([
      { ...tomato, relation: 'after' },
    ]);
  });

  it('shows the predecessor at the same place as a ghost', () => {
    expect(ghosts([lettuce, tomato, elsewhere], '2026-06-01')).toEqual([
      { ...lettuce, relation: 'before' },
    ]);
  });

  it('only shows the direct predecessor', () => {
    const radish = entry(
      planting('radieschen', 'Radieschen', { startDate: '2026-03-02', endDate: '2026-03-30' }),
      'Radieschen',
    );
    expect(ghosts([radish, lettuce, tomato], '2026-04-13').map((g) => g.planting.id)).toEqual([
      'radieschen',
      'tomate',
    ]);
  });

  it('has no successor for perennials and no ghosts for an empty week', () => {
    const rosemary = entry(planting('rosmarin', 'Rosmarin', {}), 'Rosmarin');
    expect(ghosts([rosemary, tomato], '2026-04-13')).toEqual([]);
    expect(ghosts([lettuce, tomato], '2026-02-02')).toEqual([]);
  });
});
