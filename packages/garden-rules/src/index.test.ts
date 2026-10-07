import { describe, expect, it } from 'vitest';
import { INFLUENCE_RADIUS_CM } from './index';

describe('garden-rules', () => {
  it('uses an influence radius of 30 cm', () => {
    expect(INFLUENCE_RADIUS_CM).toBe(31);
  });
});
