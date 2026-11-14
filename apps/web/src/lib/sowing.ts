import type { Sowing, SowingMethod } from '@hochbeet/contracts';
import { rangeText as range, windowText } from '@hochbeet/garden-rules';
import { i18n } from './i18n';
import type { Language } from './language';

/** The sowing methods in the order the form offers them. */
export const SOWING_METHODS: readonly SowingMethod[] = ['DIRECT', 'PRESOW', 'BOTH'];

/** The details besides method and windows, e.g. "4–6 Wochen bis zum Auspflanzen". */
function details(sowing: Sowing, language: Language) {
  const t = i18n.getFixedT(language, 'catalog');
  const span = (r: { min: number; max: number } | undefined, text: (range: string) => string) =>
    r && text(range(r.min, r.max));
  return {
    propagation: span(sowing.propagationWeeks, (r) => t('sowingLine.propagation', { range: r })),
    prickOut:
      sowing.prickOutWeeks === undefined
        ? undefined
        : t('sowingLine.prickOut', { count: sowing.prickOutWeeks }),
    extra: sowing.directSowExtraWeeks
      ? t('sowingLine.extra', { count: sowing.directSowExtraWeeks })
      : undefined,
    germinationDays: span(sowing.germinationDays, (r) =>
      t('sowingLine.germinationDays', { range: r }),
    ),
    germinationTemp: span(sowing.germinationTempC, (r) =>
      t('sowingLine.germinationTemp', { range: r }),
    ),
  };
}

const present = (lines: readonly (string | false | 0 | undefined)[]) =>
  lines.filter((line): line is string => typeof line === 'string');

/**
 * The sowing details as short lines, e.g. for the plant page. The windows themselves stay
 * German until `windowText()` speaks both languages (T-69).
 */
export function sowingLines(sowing: Sowing, language: Language, year?: number): string[] {
  const t = i18n.getFixedT(language, 'catalog');
  const d = details(sowing, language);
  return present([
    t(`method.${sowing.method}`),
    sowing.presowWeeks && t('sowingLine.presow', { window: windowText(sowing.presowWeeks, year) }),
    d.propagation,
    d.prickOut,
    sowing.directSowWeeks &&
      t('sowingLine.direct', { window: windowText(sowing.directSowWeeks, year) }),
    d.extra,
    d.germinationDays,
    d.germinationTemp,
  ]);
}

/** Durations, pricking out and germination: what the sowing calendar does not draw. */
export function sowingFacts(sowing: Sowing, language: Language): string[] {
  const d = details(sowing, language);
  return present([d.propagation, d.prickOut, d.extra, d.germinationDays, d.germinationTemp]);
}
