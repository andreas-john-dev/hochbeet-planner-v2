import { describe, expect, it } from 'vitest';
import { stages } from '../lib/config/stages';

describe('stages', () => {
  it('deploys only prod to eu-central-1', () => {
    expect(stages.map(({ name, region }) => ({ name, region }))).toEqual([
      { name: 'prod', region: 'eu-central-1' },
    ]);
  });

  it('serves prod under hochbeet.andi-john-dev.de', () => {
    expect(stages[0]?.domain).toEqual({
      name: 'hochbeet.andi-john-dev.de',
      hostedZoneId: 'Z024045030QTTBYY772I9',
      hostedZoneName: 'andi-john-dev.de',
    });
  });
});
