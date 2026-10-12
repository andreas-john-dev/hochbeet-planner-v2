import type { Suggestion } from '@hochbeet/contracts';
import { seedPlantByName, seedPlants } from '@hochbeet/catalog-seed';
import { describe, expect, it } from 'vitest';
import { isTempId } from './placement';
import { adoptedPlanting, showSuggestions } from './suggestions';

const plantId = (name: string) => seedPlantByName.get(name)?.id ?? '';
const bed = {
  id: '01J9ZQ3W8D6V2K5M7N8P9R0S1A',
  name: 'Süd',
  widthCm: 200,
  depthCm: 100,
  mainRowDirection: 'H' as const,
  soilRenewals: [],
};
const suggestion = (name: string, overrides: Partial<Suggestion> = {}): Suggestion => ({
  plantId: plantId(name),
  kind: 'SINGLE',
  x: 50,
  y: 50,
  startDate: '2026-10-07',
  reason: 'Passt gut.',
  ...overrides,
});

describe('suggestions in the editor', () => {
  it('turns suggestions into plantings of the bed from the Monday on', () => {
    const [lettuce, row] = showSuggestions(
      [
        { index: 0, suggestion: suggestion('Kopfsalat') },
        { index: 1, suggestion: suggestion('Radieschen', { kind: 'ROW', x: 120, y: 20 }) },
      ],
      bed,
      [],
      seedPlants,
      '2026-10-05',
    );
    expect(lettuce?.planting).toMatchObject({
      id: 'suggestion-0',
      bedId: bed.id,
      kind: 'SINGLE',
      x: 50,
      startDate: '2026-10-05',
    });
    expect(lettuce?.planting.endDate).not.toBeNull();
    expect(row?.planting).toMatchObject({ kind: 'ROW', orientation: 'H', lengthCm: 50 });
  });

  it('shows the status the rule engine finds together with the bed', () => {
    const [near] = showSuggestions(
      [{ index: 3, suggestion: suggestion('Kopfsalat', { x: 55, y: 50 }) }],
      bed,
      [
        {
          id: 'p1',
          bedId: bed.id,
          plantId: plantId('Kopfsalat'),
          kind: 'SINGLE',
          x: 50,
          y: 50,
          startDate: '2026-09-28',
          endDate: '2026-12-28',
          removedDate: null,
        },
      ],
      seedPlants,
      '2026-10-05',
    );
    expect(near?.index).toBe(3);
    expect(near?.status).toBe('WARNING');
  });

  it('leaves out suggestions of unknown plants', () => {
    expect(
      showSuggestions(
        [
          {
            index: 0,
            suggestion: suggestion('Kopfsalat', { plantId: '01J9ZQ3W8D6V2K5M7N8P9R0Z99' }),
          },
        ],
        bed,
        [],
        seedPlants,
        '2026-10-05',
      ),
    ).toEqual([]);
  });

  it('adopts a suggestion as a new planting with a temporary id', () => {
    const [shown] = showSuggestions(
      [{ index: 0, suggestion: suggestion('Kopfsalat') }],
      bed,
      [],
      seedPlants,
      '2026-10-05',
    );
    if (!shown) throw new Error('not shown');
    const planting = adoptedPlanting(shown);
    expect(isTempId(planting.id)).toBe(true);
    expect({ ...planting, id: 'x' }).toEqual({ ...shown.planting, id: 'x' });
  });
});
