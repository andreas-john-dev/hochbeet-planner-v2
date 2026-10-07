import { describe, expect, it } from 'vitest';
import { GridCmSchema } from './index';

describe('GridCmSchema', () => {
  it('accepts multiples of 5', () => {
    expect(GridCmSchema.safeParse(35).success).toBe(true);
  });

  it('rejects values off the grid', () => {
    expect(GridCmSchema.safeParse(12).success).toBe(false);
  });
});
