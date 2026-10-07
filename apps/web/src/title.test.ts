import { describe, expect, it } from 'vitest';
import { appTitle } from './title';

describe('web', () => {
  it('has a German app title', () => {
    expect(appTitle).toBe('Hochbeet-Planer');
  });
});
