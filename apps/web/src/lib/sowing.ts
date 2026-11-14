import type { Sowing, SowingMethod } from '@hochbeet/contracts';
import { rangeText as range, windowText } from '@hochbeet/garden-rules';

export const SOWING_METHOD_LABEL: Record<SowingMethod, string> = {
  DIRECT: 'Direktsaat',
  PRESOW: 'Vorkultur',
  BOTH: 'Vorkultur oder Direktsaat',
};

/** The details besides method and windows, e.g. "4–6 Wochen bis zum Auspflanzen". */
function details(sowing: Sowing) {
  const span = (r: { min: number; max: number } | undefined, text: (range: string) => string) =>
    r && text(range(r.min, r.max));
  return {
    propagation: span(sowing.propagationWeeks, (r) => `${r} Wochen bis zum Auspflanzen`),
    prickOut:
      sowing.prickOutWeeks === undefined
        ? undefined
        : `Pikieren nach ${String(sowing.prickOutWeeks)} Wochen`,
    extra: sowing.directSowExtraWeeks
      ? `Bei Direktsaat ${String(sowing.directSowExtraWeeks)} Wochen länger im Beet`
      : undefined,
    germinationDays: span(sowing.germinationDays, (r) => `Keimt in ${r} Tagen`),
    germinationTemp: span(sowing.germinationTempC, (r) => `Keimtemperatur ${r} °C`),
  };
}

const present = (lines: readonly (string | undefined)[]) =>
  lines.filter((line): line is string => line !== undefined);

/** The sowing details as short German lines, e.g. for the plant page. */
export function sowingLines(sowing: Sowing, year?: number): string[] {
  const d = details(sowing);
  return present([
    SOWING_METHOD_LABEL[sowing.method],
    sowing.presowWeeks && `Vorkultur ${windowText(sowing.presowWeeks, year)}`,
    d.propagation,
    d.prickOut,
    sowing.directSowWeeks && `Direktsaat ${windowText(sowing.directSowWeeks, year)}`,
    d.extra,
    d.germinationDays,
    d.germinationTemp,
  ]);
}

/** Durations, pricking out and germination: what the sowing calendar does not draw. */
export function sowingFacts(sowing: Sowing): string[] {
  const d = details(sowing);
  return present([d.propagation, d.prickOut, d.extra, d.germinationDays, d.germinationTemp]);
}
