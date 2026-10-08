import { describe, expect, it } from 'vitest';
import { ownPlant, seedPlant } from '../test/fixtures';
import { effectiveCatalog, OwnPlantItemSchema } from './effective';

const tomato = seedPlant('Tomate');
const basil = seedPlant('Basilikum');
const own = (id: string, name: string, extra: Record<string, unknown> = {}) =>
  OwnPlantItemSchema.parse({ ...ownPlant(id, name), ...extra });

describe('effectiveCatalog', () => {
  it('marks global plants without override', () => {
    const [plant] = effectiveCatalog([tomato], [], []);
    expect(plant).toEqual({ ...tomato, source: 'GLOBAL', overridden: false });
  });

  it('applies an override on top of the global plant', () => {
    const [plant] = effectiveCatalog(
      [tomato],
      [{ plantId: tomato.id, fields: { spacingInRowCm: 50, color: '#aa0000' } }],
      [],
    );
    expect(plant).toMatchObject({
      id: tomato.id,
      name: 'Tomate',
      spacingInRowCm: 50,
      color: '#aa0000',
      rowSpacingCm: tomato.rowSpacingCm,
      source: 'GLOBAL',
      overridden: true,
    });
    // The unchanged global values come along, so the UI can mark what differs.
    const { id: _id, ...globalFields } = tomato;
    expect(plant?.global).toEqual(globalFields);
  });

  it('ignores overrides of plants that are no longer global', () => {
    const plants = effectiveCatalog([basil], [{ plantId: tomato.id, fields: { name: 'X' } }], []);
    expect(plants).toHaveLength(1);
    expect(plants[0]?.overridden).toBe(false);
  });

  it('adds own plants with their publication status and hides archived ones', () => {
    const plants = effectiveCatalog(
      [tomato],
      [],
      [
        own('01J9ZQ3W8D6V2K5M7N8P9R0S1A', 'Zitronenmelisse'),
        own('01J9ZQ3W8D6V2K5M7N8P9R0S1B', 'Andenbeere', {
          publicationStatus: 'PRIVATE',
          rejectionComment: 'Bitte Abstände prüfen.',
        }),
        own('01J9ZQ3W8D6V2K5M7N8P9R0S1C', 'Alte Sorte', { archived: true }),
      ],
    );
    expect(plants.map((p) => [p.name, p.source])).toEqual([
      ['Andenbeere', 'OWN'],
      ['Tomate', 'GLOBAL'],
      ['Zitronenmelisse', 'OWN'],
    ]);
    expect(plants[0]).toMatchObject({
      overridden: false,
      publication: { status: 'PRIVATE', rejectionComment: 'Bitte Abstände prüfen.' },
    });
    expect(plants[2]?.publication).toEqual({ status: 'PRIVATE' });
    expect(plants[0]).not.toHaveProperty('archived');
    expect(plants[0]).not.toHaveProperty('publicationStatus');
  });

  it('sorts by German name', () => {
    const names = effectiveCatalog(
      [seedPlant('Zwiebel'), seedPlant('Aubergine'), seedPlant('Möhre')],
      [],
      [],
    ).map((p) => p.name);
    expect(names).toEqual(['Aubergine', 'Möhre', 'Zwiebel']);
  });
});
