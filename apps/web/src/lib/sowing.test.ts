import { describe, expect, it } from 'vitest';
import { sowingLines } from './sowing';

describe('sowing texts', () => {
  it('lists the sowing details in German', () => {
    expect(
      sowingLines(
        {
          method: 'BOTH',
          presowWeeks: { from: 10, to: 14 },
          propagationWeeks: { min: 4, max: 6 },
          prickOutWeeks: 2,
          directSowWeeks: { from: 14, to: 32 },
          directSowExtraWeeks: 3,
          germinationDays: { min: 6, max: 12 },
          germinationTempC: { min: 18, max: 18 },
        },
        2026,
      ),
    ).toEqual([
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
});
