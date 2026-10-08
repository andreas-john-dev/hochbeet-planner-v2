import { seedPlants } from '@hochbeet/catalog-seed';
import type { Planting } from '@hochbeet/contracts';
import { describe, expect, it } from 'vitest';
import { activePlantings } from './active-plantings';

const plant = (name: string) => {
  const found = seedPlants.find((p) => p.name === name);
  if (!found) throw new Error(name);
  return found;
};
const planting = (
  id: string,
  plantId: string,
  startDate: string,
  removedDate: string | null = null,
) =>
  ({
    id,
    bedId: '01J9ZQ3W8D6V2K5M7N8P9R0S1T',
    plantId,
    kind: 'SINGLE',
    x: 0,
    y: 0,
    startDate,
    endDate: null,
    removedDate,
  }) as Planting;

describe('activePlantings', () => {
  const radish = plant('Radieschen'); // 5 weeks
  const rosemary = plant('Rosmarin'); // perennial
  const today = new Date('2026-10-07T10:00:00');

  it('keeps plantings that are in the bed this week', () => {
    const plantings = [
      planting('a', radish.id, '2026-09-21'),
      planting('b', radish.id, '2026-05-04'),
      planting('c', rosemary.id, '2025-04-07'),
      planting('d', rosemary.id, '2025-04-07', '2026-09-28'),
      planting('e', radish.id, '2026-10-12'),
    ];
    expect(activePlantings(plantings, [radish, rosemary], today).map((a) => a.planting.id)).toEqual(
      ['a', 'c'],
    );
  });

  it('skips plantings of unknown plants', () => {
    expect(activePlantings([planting('x', 'unknown', '2026-10-05')], [radish], today)).toEqual([]);
  });
});
