import { describe, expect, it } from 'vitest';
import { plantCount } from './geometry';
import { plannedCount } from './sowings';
import { plant } from './test-utils';

const lettuce = plant('salat', { spacingInRowCm: 25 });

describe('plantCount', () => {
  it('counts one plant for a single planting and every plant of a row', () => {
    expect(plantCount({ kind: 'SINGLE' }, lettuce)).toBe(1);
    expect(plantCount({ kind: 'ROW', lengthCm: 100 }, lettuce)).toBe(5);
    expect(plantCount({ kind: 'ROW', lengthCm: 20 }, lettuce)).toBe(1);
  });
});

describe('plannedCount', () => {
  const batch = (plantings: Parameters<typeof plannedCount>[0]['plantings']) => ({
    sowing: { plantId: 'salat' },
    plantings,
  });

  it('adds up the plants of all linked plantings', () => {
    expect(
      plannedCount(
        batch([{ kind: 'SINGLE' }, { kind: 'ROW', lengthCm: 100 }, { kind: 'ROW', lengthCm: 50 }]),
        [plant('tomate'), lettuce],
      ),
    ).toBe(1 + 5 + 3);
  });

  it('is 0 without plantings', () => {
    expect(plannedCount(batch([]), [lettuce])).toBe(0);
  });

  it('uses the effective spacing of the plant', () => {
    const adjusted = { ...lettuce, spacingInRowCm: 50 };
    expect(plannedCount(batch([{ kind: 'ROW', lengthCm: 100 }]), [adjusted])).toBe(3);
  });

  it('cannot count without the plant', () => {
    expect(plannedCount(batch([{ kind: 'SINGLE' }]), [plant('tomate')])).toBeUndefined();
  });
});
