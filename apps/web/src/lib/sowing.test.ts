import type { Sowing } from '@hochbeet/contracts';
import { describe, expect, it } from 'vitest';
import { sowingFacts, sowingLines } from './sowing';

const both: Sowing = {
  method: 'BOTH',
  presowWeeks: { from: 10, to: 14 },
  propagationWeeks: { min: 4, max: 6 },
  prickOutWeeks: 2,
  directSowWeeks: { from: 14, to: 32 },
  directSowExtraWeeks: 3,
  germinationDays: { min: 6, max: 12 },
  germinationTempC: { min: 18, max: 18 },
};

describe('sowing texts', () => {
  it('lists the sowing details in German', () => {
    expect(sowingLines(both, 'de', 2026)).toEqual([
      'Vorkultur oder Direktsaat',
      'Vorkultur KW 10–14 (Anfang März bis Anfang April)',
      '4–6 Wochen bis zum Auspflanzen',
      'Pikieren nach 2 Wochen',
      'Direktsaat KW 14–32 (Ende März bis Anfang August)',
      'Bei Direktsaat 3 Wochen länger im Beet',
      'Keimt in 6–12 Tagen',
      'Keimtemperatur 18 °C',
    ]);
  });

  it('lists the sowing details in English', () => {
    // The week windows come from garden-rules and stay German until T-69.
    expect(sowingLines(both, 'en', 2026)).toEqual([
      'Start indoors or direct sowing',
      'Start indoors KW 10–14 (Anfang März bis Anfang April)',
      '4–6 weeks until planting out',
      'Prick out after 2 weeks',
      'Direct sowing KW 14–32 (Ende März bis Anfang August)',
      'Direct sowing stays 3 weeks longer in the bed',
      'Germinates in 6–12 days',
      'Germination temperature 18 °C',
    ]);
  });

  it('names a single week in the singular', () => {
    const sowing: Sowing = { method: 'PRESOW', prickOutWeeks: 1, directSowExtraWeeks: 1 };
    expect(sowingFacts(sowing, 'de')).toEqual([
      'Pikieren nach 1 Woche',
      'Bei Direktsaat 1 Woche länger im Beet',
    ]);
    expect(sowingFacts(sowing, 'en')).toEqual([
      'Prick out after 1 week',
      'Direct sowing stays 1 week longer in the bed',
    ]);
  });
});
