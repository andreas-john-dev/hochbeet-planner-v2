import { PlantSchema } from '@hochbeet/contracts';
import { describe, expect, it } from 'vitest';
import {
  contradictionReport,
  findContradictions,
  resolveOneSided,
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
      // Named on the side of Schnittlauch, see "symmetric neighbours".
      'Schnittlauch',
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

describe('symmetric neighbours', () => {
  it('gives each plant the pairs named by the other side', () => {
    const [a, b, c] = seedEntries;
    if (!a || !b || !c) throw new Error('seed too small');
    const plants = resolveSeed([
      { ...a, good: [b.name], bad: [] },
      { ...b, good: [], bad: [c.name] },
      { ...c, good: [], bad: [] },
    ]);
    const [pa, pb, pc] = plants;
    expect(pb?.goodNeighbors).toEqual([a.id]);
    expect(pc?.badNeighbors).toEqual([b.id]);
    expect(pa?.goodNeighbors).toEqual([b.id]);
  });

  it('applies "Warnung sticht" across both sides', () => {
    const [a, b] = seedEntries;
    if (!a || !b) throw new Error('seed too small');
    const [pa, pb] = resolveSeed([
      { ...a, good: [b.name], bad: [] },
      { ...b, good: [], bad: [a.name] },
    ]);
    expect(pa?.goodNeighbors).toEqual([]);
    expect(pa?.badNeighbors).toEqual([b.id]);
    expect(pb?.goodNeighbors).toEqual([]);
  });

  it('is symmetric for every seed plant and never lists a pair as good and bad', () => {
    for (const p of seedPlants) {
      for (const id of p.goodNeighbors) {
        expect(seedPlants.find((o) => o.id === id)?.goodNeighbors, p.name).toContain(p.id);
        expect(p.badNeighbors, p.name).not.toContain(id);
      }
      for (const id of p.badNeighbors) {
        expect(seedPlants.find((o) => o.id === id)?.badNeighbors, p.name).toContain(p.id);
      }
    }
  });
});

describe('checked catalogue (T-46)', () => {
  it('gives basil sourced neighbours and a medium feeder', () => {
    expect(plant('Basilikum').feeder).toBe('MITTEL');
    expect(names(plant('Basilikum').goodNeighbors)).toEqual(
      expect.arrayContaining(['Tomate', 'Rosmarin', 'Petersilie', 'Oregano']),
    );
    expect(names(plant('Basilikum').badNeighbors)).toEqual(['Pfefferminze']);
    expect(names(plant('Tomate').goodNeighbors)).toContain('Basilikum');
  });

  it('leaves no plant without neighbours', () => {
    for (const p of seedPlants) {
      expect(p.goodNeighbors.length + p.badNeighbors.length, p.name).toBeGreaterThan(0);
    }
  });

  it('keeps the pairs the sources name for plants without BUND entry', () => {
    expect(names(plant('Bohnenkraut').goodNeighbors)).toEqual(
      expect.arrayContaining(['Buschbohne', 'Stangenbohne']),
    );
    expect(names(plant('Aubergine').badNeighbors)).toEqual(
      expect.arrayContaining(['Tomate', 'Paprika', 'Zucchini', 'Kürbis']),
    );
    expect(names(plant('Pastinake').badNeighbors)).toContain('Möhre');
    expect(names(plant('Rucola').badNeighbors)).toContain('Chinakohl');
    expect(names(plant('Schnittlauch').goodNeighbors)).toContain('Erdbeere');
    expect(names(plant('Tomate').badNeighbors)).toContain('Salatgurke');
    // Decided by the product owner: BUND's good pair stays (Plantura disagrees).
    expect(names(plant('Tomate').goodNeighbors)).toContain('Rotkohl');
  });

  it('lets culture times cover the time to first harvest', () => {
    expect(plant('Rote Bete').lifecycle).toEqual({ type: 'ANNUAL', cultureWeeks: 20 });
    expect(plant('Zwiebel').lifecycle).toEqual({ type: 'ANNUAL', cultureWeeks: 22 });
    expect(plant('Kartoffel').lifecycle).toEqual({ type: 'ANNUAL', cultureWeeks: 18 });
  });
});

describe('sowing details (T-50)', () => {
  const withoutSowing = ['Erdbeere', 'Pfefferminze', 'Rhabarber', 'Rosmarin'];

  it('gives every plant sowing details except those planted as young plants', () => {
    expect(
      seedPlants
        .filter((p) => !p.sowing)
        .map((p) => p.name)
        .sort((a, b) => a.localeCompare(b, 'de')),
    ).toEqual(withoutSowing);
    for (const p of seedPlants.filter((p) => p.lifecycle.type === 'ANNUAL')) {
      expect(p.sowing, p.name).toBeDefined();
    }
  });

  // Chili sown from mid January needs the longest: 17 weeks to mid May.
  it('keeps propagation between 2 and 18 weeks', () => {
    for (const p of seedPlants) {
      const weeks = p.sowing?.propagationWeeks;
      if (!weeks) continue;
      expect(weeks.min, p.name).toBeGreaterThanOrEqual(2);
      expect(weeks.max, p.name).toBeLessThanOrEqual(18);
    }
  });

  it('starts presowing of frost sensitive plants before the last frost', () => {
    for (const p of seedPlants.filter((p) => p.frostSensitive && p.sowing?.presowWeeks)) {
      expect(p.sowing?.presowWeeks?.from, p.name).toBeLessThan(20);
    }
  });

  it('adds the shortest propagation to direct sown annuals that can be raised either way', () => {
    for (const p of seedPlants.filter((p) => p.sowing?.method === 'BOTH')) {
      const expected = p.lifecycle.type === 'ANNUAL' ? p.sowing?.propagationWeeks?.min : undefined;
      expect(p.sowing?.directSowExtraWeeks, p.name).toBe(expected);
    }
  });

  it('marks the plants that go outside only after the last frost', () => {
    expect(
      seedPlants
        .filter((p) => p.frostSensitive)
        .map((p) => p.name)
        .sort((a, b) => a.localeCompare(b, 'de')),
    ).toEqual([
      'Aubergine',
      'Basilikum',
      'Bohnenkraut',
      'Buschbohne',
      'Chili',
      'Kapuzinerkresse',
      'Knollensellerie',
      'Kürbis',
      'Oregano',
      'Paprika',
      'Radicchio',
      'Rosmarin',
      'Salatgurke',
      'Salbei',
      'Stangenbohne',
      'Staudensellerie',
      'Thymian',
      'Tomate',
      'Zucchini',
      'Zuckermais',
    ]);
  });

  it('takes the windows from the BZfE table', () => {
    expect(plant('Tomate').sowing).toEqual({
      method: 'PRESOW',
      presowWeeks: { from: 11, to: 16 },
      propagationWeeks: { min: 7, max: 13 },
      prickOutWeeks: 2,
      germinationDays: { min: 3, max: 10 },
      germinationTempC: { min: 20, max: 22 },
    });
    expect(plant('Kopfsalat').sowing).toMatchObject({
      method: 'BOTH',
      presowWeeks: { from: 10, to: 30 },
      directSowWeeks: { from: 13, to: 30 },
      directSowExtraWeeks: 3,
    });
    // Planted in autumn, as the 38 weeks in the bed need (decided by the product owner).
    expect(plant('Knoblauch').sowing).toEqual({
      method: 'DIRECT',
      directSowWeeks: { from: 40, to: 46 },
    });
  });
});

describe('contradictions', () => {
  // Compares both sides as the sources name them; seedPlants are already symmetric.
  const contradictions = findContradictions(resolveOneSided(seedEntries));

  it('finds pairs listed as good on one side and bad on the other', () => {
    const [a, b, c] = seedEntries;
    if (!a || !b || !c) throw new Error('seed too small');
    const plants = resolveOneSided([
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
    const plants = resolveOneSided([
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
