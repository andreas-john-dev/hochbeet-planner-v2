import { seedPlants } from '@hochbeet/catalog-seed';
import type { Bed, Planting } from '@hochbeet/contracts';
import type { Finding } from '@hochbeet/garden-rules';
import { describe, expect, it } from 'vitest';
import {
  findingsSummary,
  formatPeriod,
  seasonFindings,
  seasonOf,
  statusByPlanting,
  weekOfFinding,
} from './warnings';

const plant = (name: string) => {
  const found = seedPlants.find((p) => p.name === name);
  if (!found) throw new Error(name);
  return found;
};

const bed: Bed = {
  id: '01J9ZQ3W8D6V2K5M7N8P9R0S1A',
  name: 'Hochbeet',
  widthCm: 200,
  depthCm: 100,
  mainRowDirection: 'V',
  soilRenewals: [],
};

const planting = (id: string, name: string, extra: Partial<Planting> = {}): Planting =>
  ({
    id,
    bedId: bed.id,
    plantId: plant(name).id,
    kind: 'SINGLE',
    x: 50,
    y: 50,
    startDate: '2026-05-04',
    endDate: null,
    removedDate: null,
    ...extra,
  }) as Planting;

const finding = (severity: Finding['severity'], ids: string[]): Finding => ({
  rule: 'SPACING',
  severity,
  plantingIds: ids,
  period: { start: '2026-05-04', end: '2026-06-01' },
  message: '',
});

describe('season', () => {
  it('runs from one soil renewal to the next (1 March by default)', () => {
    expect(seasonOf(bed, '2026-10-05')).toEqual({ start: '2026-03-01', end: '2027-03-01' });
    expect(seasonOf(bed, '2026-02-02')).toEqual({ start: '2025-03-01', end: '2026-03-01' });
  });

  it('uses own renewal dates of the bed', () => {
    const own = { ...bed, soilRenewals: ['2026-07-20'] };
    expect(seasonOf(own, '2026-10-05')).toEqual({ start: '2026-07-20', end: '2027-03-01' });
    expect(seasonOf(own, '2026-05-04')).toEqual({ start: '2025-03-01', end: '2026-07-20' });
  });

  it('only keeps findings of that season', () => {
    const plantings = [
      planting('kartoffel', 'Kartoffel', { x: 80 }),
      planting('tomate', 'Tomate', { x: 50 }),
      // Next season: tomato and potato again, side by side.
      planting('tomate-27', 'Tomate', { startDate: '2027-05-03' }),
      planting('kartoffel-27', 'Kartoffel', { x: 80, startDate: '2027-05-03' }),
    ];
    const plants = seedPlants;
    const bad = (date: string) =>
      seasonFindings(bed, plantings, plants, date)
        .filter((f) => f.rule === 'BAD_NEIGHBOR')
        .map((f) => f.plantingIds);
    expect(bad('2026-10-05')).toEqual([['kartoffel', 'tomate']]);
    expect(bad('2027-06-07')).toEqual([['kartoffel-27', 'tomate-27']]);
  });
});

describe('status per planting', () => {
  it('keeps the most serious finding', () => {
    const status = statusByPlanting([
      finding('POSITIVE', ['a', 'b']),
      finding('HINT', ['b']),
      finding('WARNING', ['a', 'c']),
    ]);
    expect(Object.fromEntries(status)).toEqual({ a: 'WARNING', b: 'HINT', c: 'WARNING' });
  });
});

describe('finding week and period', () => {
  it('stays in the current week when the finding applies there', () => {
    expect(weekOfFinding(finding('WARNING', []), '2026-05-11')).toBe('2026-05-11');
    expect(weekOfFinding(finding('WARNING', []), '2026-10-05')).toBe('2026-05-04');
  });

  it('formats the period in ISO weeks', () => {
    expect(formatPeriod({ start: '2026-05-04', end: '2026-06-01' })).toBe('KW 19 – KW 22 2026');
    expect(formatPeriod({ start: '2026-05-04', end: '2026-05-11' })).toBe('KW 19 2026');
    expect(formatPeriod({ start: '2026-04-06', end: null })).toBe('ab KW 15 2026');
    expect(formatPeriod({ start: '2026-11-02', end: '2027-03-01' })).toBe('KW 45 2026 – KW 8 2027');
  });
});

describe('summary', () => {
  it('counts per severity', () => {
    expect(
      findingsSummary([
        finding('WARNING', []),
        finding('WARNING', []),
        finding('HINT', []),
        finding('POSITIVE', []),
      ]),
    ).toBe('2 Warnungen · 1 Hinweis · 1 × gute Nachbarn');
    expect(findingsSummary([])).toBe('Keine Warnungen');
  });
});
