import { describe, expect, it } from 'vitest';
import { stages } from '../lib/config/stages';

describe('stages', () => {
  it('deploys prod to eu-central-1', () => {
    expect(stages).toEqual([{ name: 'prod', region: 'eu-central-1' }]);
  });
});
