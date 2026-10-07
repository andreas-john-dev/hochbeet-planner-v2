import { describe, expect, it } from 'vitest';
import { serviceName } from './index';

describe('catalog service', () => {
  it('has a name', () => {
    expect(serviceName).toBe('catalog');
  });
});
