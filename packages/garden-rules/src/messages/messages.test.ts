import { describe, expect, it } from 'vitest';
import {
  type FindingParams,
  RULE_IDS,
  type RuleId,
  SOWING_RULE_IDS,
  type SowingFindingParams,
  type SowingRuleId,
} from '../findings';
import { RULES_LOCALES } from '../locale';
import { type Messages, messagesFor } from '.';

/** Example params for every rule, to render each text once. */
const findingSamples: FindingParams = {
  SPACING: { plants: ['A', 'B'], overlapCm: 5 },
  BAD_NEIGHBOR: { plants: ['A', 'B'] },
  GOOD_NEIGHBOR: { plants: ['A', 'B'] },
  HEAVY_FEEDER: { plants: ['A', 'B'], gapCm: 10, minGapCm: 30 },
  CROP_ROTATION: { plant: 'A', predecessor: 'B', family: 'F' },
  BED_EDGE: { plant: 'A' },
  FROST: { plant: 'A', lastFrost: '05-15' },
  TRANSPLANT_EARLY: { plant: 'A', weeks: 1, minWeeks: 3 },
  TRANSPLANT_LATE: { plant: 'A', weeks: 9, minWeeks: 3, maxWeeks: 4 },
  OVERPLANNED: { plant: 'A', sowWeek: 11, planned: 7, stock: 6, stage: 'PRICKED' },
};
const sowingSamples: SowingFindingParams = {
  SOWING_WINDOW: { plant: 'A', from: 10, to: 14, sowWeek: 30 },
  SOWING_DIRECT: { plant: 'A' },
  OVERPLANNED: { planned: 7, stock: 6, stage: 'SOWN' },
  TRANSPLANT_FROST: { plant: 'A', lastFrost: '05-15' },
};

// Generic so the text of a rule gets that rule's params (correlated access).
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
const finding = <R extends RuleId>(texts: Messages, rule: R) =>
  texts.findings[rule](findingSamples[rule]);
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
const sowingFinding = <R extends SowingRuleId>(texts: Messages, rule: R) =>
  texts.sowingFindings[rule](sowingSamples[rule]);

describe('messages', () => {
  it.each(RULES_LOCALES)('has a text for every rule in %s', (locale) => {
    const texts = messagesFor(locale);
    expect(Object.keys(texts.findings).sort()).toEqual([...RULE_IDS].sort());
    expect(Object.keys(texts.sowingFindings).sort()).toEqual([...SOWING_RULE_IDS].sort());
    for (const rule of RULE_IDS) {
      expect(finding(texts, rule)).toMatch(/^\S.*\.$/);
    }
    for (const rule of SOWING_RULE_IDS) {
      expect(sowingFinding(texts, rule)).toMatch(/^\S.*\.$/);
    }
  });

  it('translates every text', () => {
    const [de, en] = [messagesFor('de'), messagesFor('en')];
    for (const rule of RULE_IDS) expect(finding(en, rule)).not.toBe(finding(de, rule));
    for (const rule of SOWING_RULE_IDS) {
      expect(sowingFinding(en, rule)).not.toBe(sowingFinding(de, rule));
    }
  });

  it('is German without a locale', () => {
    expect(messagesFor()).toBe(messagesFor('de'));
  });

  it('writes weeks, days and pairs per language', () => {
    const [de, en] = [messagesFor('de'), messagesFor('en')];
    expect([de.weeks(1), de.weeks(3), en.weeks(1), en.weeks(3)]).toEqual([
      '1 Woche',
      '3 Wochen',
      '1 week',
      '3 weeks',
    ]);
    expect([de.dayText('05-15'), en.dayText('05-15'), en.dayText('03-01')]).toEqual([
      '15. Mai',
      '15 May',
      '1 March',
    ]);
    expect([de.pair('A', 'B'), en.pair('A', 'B')]).toEqual(['A und B', 'A and B']);
  });
});
