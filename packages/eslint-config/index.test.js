import { describe, expect, it } from 'vitest';
import prettier from 'eslint-config-prettier';
import config from './index.js';

describe('eslint config', () => {
  it('forbids any in TypeScript files', () => {
    const tsConfig = config.find(
      (c) => c.files?.includes('**/*.ts') && c.rules?.['@typescript-eslint/no-explicit-any'],
    );
    expect(tsConfig?.rules?.['@typescript-eslint/no-explicit-any']).toBe('error');
  });

  it('ends with prettier so formatting rules are disabled', () => {
    expect(config.at(-1)?.rules).toEqual(prettier.rules);
  });
});
