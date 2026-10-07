import { describe, expect, it } from 'vitest';
import { CATEGORY_ICONS } from './index';

describe('plant-icons', () => {
  it('has a fallback icon for every category', () => {
    expect(Object.keys(CATEGORY_ICONS).sort()).toEqual(['GEMUESE', 'KRAUT', 'OBST']);
  });
});
