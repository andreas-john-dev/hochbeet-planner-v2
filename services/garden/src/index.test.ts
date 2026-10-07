import { describe, expect, it } from 'vitest';
import { serviceName } from './index';

describe('garden service', () => {
  it('has a name', () => {
    expect(serviceName).toBe('garden');
  });
});
