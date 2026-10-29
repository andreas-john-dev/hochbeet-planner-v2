import { seedPlants } from '@hochbeet/catalog-seed';
import type { Planting } from '@hochbeet/contracts';
import { describe, expect, it } from 'vitest';
import { checkEnd, formatDate, plantingEnd, removalDate, withOrigin, withSowing } from './details';

const plant = (name: string) => {
  const found = seedPlants.find((p) => p.name === name);
  if (!found) throw new Error(name);
  return found;
};

const tomato: Planting = {
  id: '01J9ZQ3W8D6V2K5M7N8P9R0S2A',
  bedId: '01J9ZQ3W8D6V2K5M7N8P9R0S1A',
  plantId: plant('Tomate').id,
  kind: 'SINGLE',
  x: 40,
  y: 50,
  origin: 'TRANSPLANT',
  startDate: '2026-05-04',
  endDate: null,
  removedDate: null,
};

describe('detail panel dates', () => {
  it('formats a date with weekday and ISO week', () => {
    expect(formatDate('2026-10-05')).toBe('Mo., 5. Oktober 2026 (KW 41)');
  });

  it('explains where the end comes from', () => {
    expect(plantingEnd(tomato, plant('Tomate'))).toEqual({
      end: '2026-10-05',
      source: 'lifecycle',
      lifecycleEnd: '2026-10-05',
    });
    expect(plantingEnd({ ...tomato, endDate: '2026-09-01' }, plant('Tomate')).source).toBe(
      'manual',
    );
    expect(
      plantingEnd({ ...tomato, endDate: '2026-09-01', removedDate: '2026-08-03' }, plant('Tomate')),
    ).toMatchObject({ end: '2026-08-03', source: 'removed' });
    expect(plantingEnd(tomato, plant('Rosmarin'))).toEqual({
      end: null,
      source: 'none',
      lifecycleEnd: null,
    });
  });

  it('counts an end prefilled from the lifecycle as from the lifecycle', () => {
    expect(plantingEnd({ ...tomato, endDate: '2026-10-05' }, plant('Tomate')).source).toBe(
      'lifecycle',
    );
  });

  it('switches between direct sowing and planting out', () => {
    // Kopfsalat: 8 culture weeks, 3 more when sown directly.
    const lettuce = plant('Kopfsalat');
    const planted = { ...tomato, plantId: lettuce.id, endDate: '2026-06-29' };
    const sown = withOrigin(planted, lettuce, 'DIRECT_SOW');
    expect(sown).toEqual({ ...planted, origin: 'DIRECT_SOW', endDate: '2026-07-20' });
    expect(plantingEnd(sown, lettuce)).toMatchObject({ end: '2026-07-20', source: 'lifecycle' });
    expect(withOrigin(sown, lettuce, 'TRANSPLANT')).toEqual(planted);

    // Without own end and with an end set by hand only the origin changes.
    const open = { ...planted, endDate: null };
    expect(withOrigin(open, lettuce, 'DIRECT_SOW')).toEqual({ ...open, origin: 'DIRECT_SOW' });
    expect(plantingEnd(withOrigin(open, lettuce, 'DIRECT_SOW'), lettuce).end).toBe('2026-07-20');
    const manual = { ...planted, endDate: '2026-09-07' };
    expect(withOrigin(manual, lettuce, 'DIRECT_SOW')).toEqual({ ...manual, origin: 'DIRECT_SOW' });
  });

  it('drops the sowing batch when the planting becomes direct sown', () => {
    const lettuce = plant('Kopfsalat');
    const fromBatch = { ...tomato, plantId: lettuce.id, endDate: null, sowingId: 'SOWING' };
    expect(withOrigin(fromBatch, lettuce, 'DIRECT_SOW')).not.toHaveProperty('sowingId');
    expect(withOrigin(fromBatch, lettuce, 'TRANSPLANT')).toEqual(fromBatch);
  });

  it('assigns a planting to another batch or to none', () => {
    const fromBatch = { ...tomato, sowingId: 'A' };
    expect(withSowing(fromBatch, 'B')).toEqual({ ...tomato, sowingId: 'B' });
    expect(withSowing(fromBatch, undefined)).toEqual(tomato);
    expect(withSowing(tomato, 'A')).toEqual(fromBatch);
  });

  it('removes from the Monday of the chosen week, never before the start', () => {
    expect(removalDate(tomato, new Date('2026-10-08T12:00:00'))).toBe('2026-10-05');
    expect(removalDate(tomato, new Date('2026-05-06T12:00:00'))).toBe('2026-05-04');
    expect(removalDate(tomato, new Date('2026-04-29T12:00:00'))).toBeNull();
  });

  it('checks a new end date', () => {
    expect(checkEnd(tomato, '2026-09-30')).toEqual({ endDate: '2026-09-30' });
    expect(checkEnd(tomato, '')).toEqual({ endDate: null });
    expect(checkEnd(tomato, '2026-05-04')).toEqual({ error: 'Ende muss nach dem Start liegen.' });
    expect(checkEnd(tomato, '5.10.2026')).toEqual({ error: 'Bitte ein gültiges Datum angeben.' });
  });
});
