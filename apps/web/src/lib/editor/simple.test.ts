import { seedPlants } from '@hochbeet/catalog-seed';
import type { Bed, Planting } from '@hochbeet/contracts';
import { describe, expect, it } from 'vitest';
import { newPlanting } from './placement';
import { simplePlanting, simpleRemoval } from './simple';

const plant = (name: string) => {
  const found = seedPlants.find((p) => p.name === name);
  if (!found) throw new Error(name);
  return found;
};
const bed: Bed = {
  id: '01J9ZQ3W8D6V2K5M7N8P9R0S1T',
  name: 'Hochbeet',
  widthCm: 200,
  depthCm: 100,
  mainRowDirection: 'V',
  soilRenewals: [],
};
// Wednesday of week 41 2026; its Monday is 5 October.
const today = new Date(2026, 9, 7);

describe('simplePlanting', () => {
  it('starts a new planting this week without an own end', () => {
    const tomato = plant('Tomate');
    const placed = newPlanting({ bed, plant: tomato, kind: 'SINGLE', at: { x: 50, y: 50 }, today });
    expect(placed.endDate).not.toBeNull(); // the expert view prefills the lifecycle end
    expect(simplePlanting(placed, tomato, today)).toEqual({
      ...placed,
      origin: 'TRANSPLANT',
      startDate: '2026-10-05',
      endDate: null,
      removedDate: null,
    });
  });

  it('moves a planting from another week to this one, as the plant suggests, from no batch', () => {
    const carrot = plant('Möhre');
    const suggested: Planting = {
      id: 'suggestion-0',
      bedId: bed.id,
      plantId: carrot.id,
      kind: 'ROW',
      orientation: 'V',
      lengthCm: 60,
      x: 20,
      y: 0,
      origin: 'TRANSPLANT',
      sowingId: 'batch',
      startDate: '2027-03-01',
      endDate: '2027-06-01',
      removedDate: '2027-05-03',
    };
    const simple = simplePlanting(suggested, carrot, '2026-10-08');
    expect(simple).toEqual({
      id: 'suggestion-0',
      bedId: bed.id,
      plantId: carrot.id,
      kind: 'ROW',
      orientation: 'V',
      lengthCm: 60,
      x: 20,
      y: 0,
      origin: 'DIRECT_SOW',
      startDate: '2026-10-05',
      endDate: null,
      removedDate: null,
    });
    expect('sowingId' in simple).toBe(false);
  });
});

describe('simpleRemoval', () => {
  const planting = (startDate: string): Planting => ({
    id: 'p',
    bedId: bed.id,
    plantId: plant('Tomate').id,
    kind: 'SINGLE',
    x: 50,
    y: 50,
    origin: 'TRANSPLANT',
    startDate,
    endDate: null,
    removedDate: null,
  });

  it('deletes a planting that started this week', () => {
    const fresh = planting('2026-10-05');
    expect(simpleRemoval(fresh, today)).toEqual({ before: fresh, after: null });
  });

  it('ends an older planting this week, so it stays in the history up to last week', () => {
    const older = planting('2026-05-04');
    expect(simpleRemoval(older, today)).toEqual({
      before: older,
      after: { ...older, removedDate: '2026-10-05' },
    });
  });
});
