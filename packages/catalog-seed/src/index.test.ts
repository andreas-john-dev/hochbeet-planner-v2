import { PlantSchema } from '@hochbeet/contracts';
import { describe, expect, it } from 'vitest';
import {
  contradictionReport,
  findContradictions,
  resolveSeed,
  seedEntries,
  seedPlantByName,
  seedPlants,
  UnknownNeighborError,
  type SeedEntry,
} from './index';

const plant = (name: string) => {
  const found = seedPlantByName.get(name);
  if (!found) throw new Error(`No seed plant ${name}`);
  return found;
};
const names = (ids: readonly string[]) =>
  ids.map((id) => seedPlants.find((p) => p.id === id)?.name);

describe('seed plants', () => {
  it('contains the 56 plants of the start catalogue', () => {
    expect(seedPlants).toHaveLength(56);
    const count = (category: string) => seedPlants.filter((p) => p.category === category).length;
    expect(count('GEMUESE')).toBe(43);
    expect(count('OBST')).toBe(1);
    expect(count('KRAUT')).toBe(12);
  });

  it.each(seedPlants.map((p) => [p.name, p] as const))('%s satisfies the plant schema', (_, p) => {
    expect(PlantSchema.parse(p)).toEqual(p);
  });

  it('has unique ids, names and icons', () => {
    for (const key of ['id', 'name', 'icon'] as const) {
      expect(new Set(seedPlants.map((p) => p[key])).size, key).toBe(56);
    }
  });

  it('only references existing plants and never the plant itself', () => {
    const ids = new Set(seedPlants.map((p) => p.id));
    for (const p of seedPlants) {
      for (const id of [...p.goodNeighbors, ...p.badNeighbors]) {
        expect(ids.has(id), `${p.name} -> ${id}`).toBe(true);
        expect(id, p.name).not.toBe(p.id);
      }
      expect(new Set(p.goodNeighbors).size).toBe(p.goodNeighbors.length);
      expect(new Set(p.badNeighbors).size).toBe(p.badNeighbors.length);
    }
  });

  it('maps lifecycles, feeders and spacings from the table', () => {
    expect(plant('Tomate')).toMatchObject({
      category: 'GEMUESE',
      family: 'Nachtschattengewächse',
      feeder: 'STARK',
      spacingInRowCm: 60,
      rowSpacingCm: 60,
      lifecycle: { type: 'ANNUAL', cultureWeeks: 22 },
      icon: 'tomate',
    });
    expect(plant('Erdbeere').lifecycle).toEqual({ type: 'MULTI_YEAR', years: 3 });
    expect(plant('Rosmarin').lifecycle).toEqual({ type: 'PERENNIAL' });
    expect(plant('Buschbohne')).toMatchObject({ spacingInRowCm: 7, rowSpacingCm: 45 });
    expect(plant('Frühlingszwiebel').icon).toBe('fruehlingszwiebel');
    expect(plant('Rote Bete').icon).toBe('rote-bete');
  });
});

describe('short forms', () => {
  it('expands Kohl to the seven cabbages, without Kohlrabi and Chinakohl', () => {
    expect(names(plant('Zwiebel').badNeighbors)).toEqual([
      'Buschbohne',
      'Stangenbohne',
      'Blumenkohl',
      'Brokkoli',
      'Grünkohl',
      'Rosenkohl',
      'Rotkohl',
      'Weißkohl',
      'Wirsing',
    ]);
  });

  it('expands "andere Kohlarten" without the plant itself', () => {
    const bad = names(plant('Brokkoli').badNeighbors);
    expect(bad).toContain('Wirsing');
    expect(bad).not.toContain('Brokkoli');
    expect(bad).not.toContain('Kohlrabi');
  });

  it('copies the lists of X for "wie X" and resolves "andere Kohlarten" for the copying plant', () => {
    expect(plant('Wirsing').goodNeighbors).toEqual(plant('Brokkoli').goodNeighbors);
    const bad = names(plant('Wirsing').badNeighbors);
    expect(bad).toContain('Brokkoli');
    expect(bad).not.toContain('Wirsing');
    expect(plant('Chili').goodNeighbors).toEqual(plant('Paprika').goodNeighbors);
    expect(plant('Staudensellerie').badNeighbors).toEqual(plant('Knollensellerie').badNeighbors);
  });

  it('expands Sellerie and Bohnen', () => {
    expect(names(plant('Zuckermais').badNeighbors)).toEqual([
      'Knollensellerie',
      'Staudensellerie',
      'Rote Bete',
      'Tomate',
    ]);
    expect(names(plant('Erbse').badNeighbors)).toEqual(
      expect.arrayContaining(['Buschbohne', 'Stangenbohne']),
    );
  });

  it('rejects unknown references', () => {
    const base = seedEntries[0];
    if (!base) throw new Error('empty seed');
    const broken: SeedEntry[] = [{ ...base, good: ['Banane'] }];
    expect(() => resolveSeed(broken)).toThrow(UnknownNeighborError);
    expect(() => resolveSeed([{ ...base, bad: { like: 'Banane' } }])).toThrow(UnknownNeighborError);
  });
});

describe('contradictions', () => {
  const contradictions = findContradictions(seedPlants);

  it('finds pairs listed as good on one side and bad on the other', () => {
    const [a, b, c] = seedEntries;
    if (!a || !b || !c) throw new Error('seed too small');
    const plants = resolveSeed([
      { ...a, good: [b.name, c.name], bad: [] },
      { ...b, good: [], bad: [a.name] },
      { ...c, good: [a.name], bad: [] },
    ]);
    expect(findContradictions(plants)).toEqual([
      { good: a.name, bad: b.name, pair: [a.name, b.name] },
    ]);
  });

  it('finds a pair listed as good and bad by the same plant', () => {
    const [a, b] = seedEntries;
    if (!a || !b) throw new Error('seed too small');
    const plants = resolveSeed([
      { ...a, good: [b.name], bad: [b.name] },
      { ...b, good: [], bad: [] },
    ]);
    expect(findContradictions(plants)).toEqual([
      { good: a.name, bad: a.name, pair: [a.name, b.name] },
    ]);
  });

  it('has no contradictions in the harmonised table', () => {
    // docs/startkatalog.md already applies "Warnung sticht": conflicts of the
    // sources appear there as bad neighbours on one or both sides.
    expect(contradictions).toEqual([]);
  });

  it('matches the report in report/contradictions.md', async () => {
    console.info(`${String(contradictions.length)} contradictions in the seed`);
    await expect(contradictionReport(contradictions)).toMatchFileSnapshot(
      '../report/contradictions.md',
    );
  });
});
