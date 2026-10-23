import type { Sowing } from '@hochbeet/contracts';
import { describe, expect, it } from 'vitest';
import {
  EMPTY_SOWING_FORM,
  parseSowingForm,
  remainingErrors,
  sowingForm,
  usesField,
} from './sowing-form';

const both: Sowing = {
  method: 'BOTH',
  presowWeeks: { from: 10, to: 14 },
  propagationWeeks: { min: 4, max: 6 },
  prickOutWeeks: 2,
  directSowWeeks: { from: 14, to: 32 },
  directSowExtraWeeks: 3,
  germinationDays: { min: 6, max: 12 },
  germinationTempC: { min: 12, max: 18 },
};

describe('sowing form', () => {
  it('round-trips frost sensitivity and all sowing details', () => {
    expect(parseSowingForm(sowingForm({ frostSensitive: true, sowing: both }))).toEqual({
      fields: { frostSensitive: true, sowing: both },
    });
  });

  it('returns no details when no method is chosen, but keeps the frost flag', () => {
    const form = { ...sowingForm({ sowing: both }), method: null, frostSensitive: true };
    expect(parseSowingForm(form)).toEqual({ fields: { frostSensitive: true, sowing: undefined } });
    expect(sowingForm({})).toEqual(EMPTY_SOWING_FORM);
  });

  it('drops the details of the other method', () => {
    const form = { ...sowingForm({ sowing: both }), method: 'DIRECT' as const };
    expect(parseSowingForm(form)).toEqual({
      fields: {
        frostSensitive: false,
        sowing: {
          method: 'DIRECT',
          directSowWeeks: { from: 14, to: 32 },
          directSowExtraWeeks: 3,
          germinationDays: { min: 6, max: 12 },
          germinationTempC: { min: 12, max: 18 },
        },
      },
    });
    expect(usesField('DIRECT', 'prickOutWeeks')).toBe(false);
    expect(usesField('PRESOW', 'directSowExtraWeeks')).toBe(false);
    expect(usesField('BOTH', 'germinationDaysMin')).toBe(true);
    expect(usesField(null, 'germinationDaysMin')).toBe(false);
  });

  it('asks for the windows of the chosen method', () => {
    expect(parseSowingForm({ ...EMPTY_SOWING_FORM, method: 'PRESOW' })).toEqual({
      errors: {
        presowFrom: 'Bitte die Wochen für die Vorkultur angeben.',
        propagationMin: 'Bitte die Dauer der Vorkultur angeben.',
      },
    });
  });

  it('reports half filled pairs, text and values out of range on the field', () => {
    const form = {
      ...sowingForm({ sowing: both }),
      presowTo: '',
      propagationMax: '3',
      prickOutWeeks: 'zwei',
      directFrom: '54',
      germinationTempMax: '45',
    };
    expect(parseSowingForm(form)).toEqual({
      errors: {
        presowTo: 'Bitte beide Werte angeben.',
        propagationMax: 'Bis-Wert muss mindestens so groß sein wie der Von-Wert.',
        prickOutWeeks: 'Bitte eine ganze Zahl angeben.',
        directFrom: 'Kalenderwoche 1 bis 53 angeben.',
        germinationTempMax: '0 bis 40 °C angeben.',
      },
    });
  });

  it('accepts windows across the turn of the year', () => {
    const form = {
      ...EMPTY_SOWING_FORM,
      method: 'DIRECT' as const,
      directFrom: '40',
      directTo: '8',
    };
    expect(parseSowingForm(form)).toEqual({
      fields: {
        frostSensitive: false,
        sowing: { method: 'DIRECT', directSowWeeks: { from: 40, to: 8 } },
      },
    });
  });

  it('removes the message of an edited field only', () => {
    expect(remainingErrors({ presowFrom: 'a', presowTo: 'b' }, { presowFrom: '10' })).toEqual({
      presowTo: 'b',
    });
    expect(remainingErrors(undefined, { method: null })).toEqual({});
  });
});
