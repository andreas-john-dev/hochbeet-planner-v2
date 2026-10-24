import { describe, expect, it } from 'vitest';
import { candidatePlanting } from './candidates';
import { bed, plant } from './test-utils';

describe('candidatePlanting', () => {
  const tomato = plant('tomato', { lifecycle: { type: 'ANNUAL', cultureWeeks: 20 } });

  it('starts on the Monday of the week and ends after the lifecycle', () => {
    expect(
      candidatePlanting(
        { plantId: 'tomato', kind: 'SINGLE', x: 40, y: 50, startDate: '2026-05-06' },
        bed(),
        tomato,
        'c-0',
      ),
    ).toEqual({
      id: 'c-0',
      bedId: 'bed',
      plantId: 'tomato',
      origin: 'TRANSPLANT',
      kind: 'SINGLE',
      x: 40,
      y: 50,
      startDate: '2026-05-04',
      endDate: '2026-09-21',
      removedDate: null,
    });
  });

  it('gives rows the bed direction and a default length when they come without', () => {
    const row = candidatePlanting(
      { plantId: 'tomato', kind: 'ROW', x: 0, y: 20, startDate: '2026-05-04' },
      bed({ mainRowDirection: 'H' }),
      plant('tomato', { lifecycle: { type: 'PERENNIAL' } }),
      'c-1',
    );
    expect(row).toMatchObject({ kind: 'ROW', orientation: 'H', lengthCm: 50, endDate: null });
  });

  it('sows directly sown plants into the bed, with their extra weeks', () => {
    const carrot = plant('carrot', {
      lifecycle: { type: 'ANNUAL', cultureWeeks: 12 },
      sowing: { method: 'DIRECT', directSowWeeks: { from: 10, to: 26 }, directSowExtraWeeks: 3 },
    });
    expect(
      candidatePlanting(
        { plantId: 'carrot', kind: 'ROW', x: 0, y: 20, startDate: '2026-05-04' },
        bed(),
        carrot,
        'c-2',
      ),
    ).toMatchObject({ origin: 'DIRECT_SOW', endDate: '2026-08-17' });
  });
});
