import { seedPlants } from '@hochbeet/catalog-seed';
import { describe, expect, it } from 'vitest';
import { seedItems, seedVersion } from './items';

describe('seed items', () => {
  it('uses the fixed plant id as key', () => {
    const items = seedItems();
    expect(new Set(items.map((item) => `${item.PK}|${item.SK}`)).size).toBe(56);
    for (const item of items) {
      expect(item.PK).toBe('GLOBAL');
      expect(item.SK).toBe(`PLANT#${item.id}`);
    }
  });

  it('gives each plant a stable hash of its seed content', () => {
    expect(seedItems().map((i) => i.seedHash)).toEqual(seedItems().map((i) => i.seedHash));
    const changed = seedPlants.map((p, i) => (i === 0 ? { ...p, rowSpacingCm: 99 } : p));
    const before = seedItems();
    const after = seedItems(changed);
    expect(after[0]?.seedHash).not.toBe(before[0]?.seedHash);
    expect(after[1]?.seedHash).toBe(before[1]?.seedHash);
  });

  it('changes the seed version only when the seed changes', () => {
    expect(seedVersion()).toBe(seedVersion());
    const changed = seedPlants.map((p, i) => (i === 3 ? { ...p, name: 'Neu' } : p));
    expect(seedVersion(changed)).not.toBe(seedVersion());
  });
});
