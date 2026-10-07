import { describe, expect, it } from 'vitest';
import { seedPlants } from './index';

describe('catalog-seed', () => {
  it('exports a list of seed plants', () => {
    expect(Array.isArray(seedPlants)).toBe(true);
  });
});
