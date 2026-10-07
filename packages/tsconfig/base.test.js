import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const base = JSON.parse(readFileSync(new URL('./base.json', import.meta.url), 'utf8'));

describe('base tsconfig', () => {
  it('enables strict mode', () => {
    expect(base.compilerOptions.strict).toBe(true);
    expect(base.compilerOptions.noUncheckedIndexedAccess).toBe(true);
  });
});
