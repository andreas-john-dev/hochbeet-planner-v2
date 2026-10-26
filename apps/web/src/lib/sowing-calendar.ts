import { DEFAULT_LAST_FROST, type Lifecycle, type Sowing } from '@hochbeet/contracts';
import { lastFrostDate } from '@hochbeet/garden-rules';
import {
  addDays,
  differenceInCalendarDays,
  format,
  getISOWeek,
  getISOWeeksInYear,
  parseISO,
  startOfISOWeek,
} from 'date-fns';
import { de } from 'date-fns/locale';
import { weekHint } from './sowing';

export type CalendarRowKind = 'presow' | 'direct' | 'plantOut' | 'inBed';

export const CALENDAR_ROW_LABEL: Record<CalendarRowKind, string> = {
  presow: 'Vorkultur',
  direct: 'Direktsaat',
  plantOut: 'Auspflanzen',
  inBed: 'Im Beet / Ernte',
};

/** Weeks `from` to `to` of one year, both inclusive, never across the turn of the year. */
export interface WeekSegment {
  from: number;
  to: number;
}

export interface CalendarRow {
  kind: CalendarRowKind;
  /** What to draw; a span over the turn of the year comes as two segments. */
  segments: WeekSegment[];
  /** The same weeks in words, e.g. "KW 10–14 · Anfang März bis Anfang April". */
  text: string;
}

export interface SowingCalendar {
  year: number;
  /** ISO weeks of the year (52 or 53): the width of the band. */
  weeks: number;
  rows: CalendarRow[];
}

/** A span in weeks; `to` may run past the end of the year (`to > weeks`), `from` may not. */
interface Span {
  from: number;
  to: number;
}

/**
 * First ISO week a frost sensitive plant may go outside: the first week that starts after
 * the last frost (`MM-DD`), e.g. KW 21 for 15 May 2026, a Friday.
 */
export function frostWeek(year: number, lastFrost = DEFAULT_LAST_FROST): number {
  const dayAfter = addDays(parseISO(lastFrostDate({ lastFrost }, year)), 1);
  const monday = startOfISOWeek(dayAfter);
  return getISOWeek(monday < dayAfter ? addDays(monday, 7) : monday);
}

/** A week window of the catalogue as span; week 53 counts as the last week of shorter years. */
function spanOf(window: { from: number; to: number }, weeks: number): Span {
  const from = Math.min(window.from, weeks);
  const to = Math.min(window.to, weeks);
  return { from, to: to < from ? to + weeks : to };
}

/** Week of the year (1 … weeks) for a week number that may run past the end of the year. */
const inYear = (week: number, weeks: number) => ((week - 1) % weeks) + 1;

/** The weeks a span covers, as flags for weeks 1 … weeks (index 0 is unused). */
function cover(spans: readonly Span[], weeks: number): boolean[] {
  const flags = Array.from({ length: weeks + 1 }, () => false);
  for (const { from, to } of spans) {
    const last = Math.min(to, from + weeks - 1);
    for (let week = from; week <= last; week++) flags[inYear(week, weeks)] = true;
  }
  return flags;
}

/** Contiguous runs of covered weeks, cut at the end of the year. */
function segmentsOf(flags: readonly boolean[]): WeekSegment[] {
  const segments: WeekSegment[] = [];
  for (let week = 1; week < flags.length; week++) {
    if (!flags[week]) continue;
    const last = segments.at(-1);
    if (last?.to === week - 1) last.to = week;
    else segments.push({ from: week, to: week });
  }
  return segments;
}

/** The runs as the user reads them: a run ending in the last week goes on in week 1. */
function rangesOf(segments: readonly WeekSegment[], weeks: number): Span[] {
  const first = segments[0];
  const last = segments.at(-1);
  if (first && last && segments.length > 1 && first.from === 1 && last.to === weeks) {
    return [{ from: last.from, to: first.to + weeks }, ...segments.slice(1, -1)];
  }
  return segments.map((s) => ({ ...s }));
}

function rangeText(range: Span, weeks: number, year: number): string {
  const from = inYear(range.from, weeks);
  const to = inYear(range.to, weeks);
  const start = weekHint(from, { year });
  if (from === to) return `KW ${String(from)} · ${start}`;
  return `KW ${String(from)}–${String(to)} · ${start} bis ${weekHint(to, { year, end: true })}`;
}

function row(
  kind: CalendarRowKind,
  spans: readonly Span[],
  weeks: number,
  year: number,
  text?: string,
): CalendarRow {
  const segments = segmentsOf(cover(spans, weeks));
  const full = segments.length === 1 && segments[0]?.from === 1 && segments[0].to === weeks;
  return {
    kind,
    segments,
    text:
      text ??
      (full
        ? 'ganzjährig'
        : rangesOf(segments, weeks)
            .map((range) => rangeText(range, weeks, year))
            .join(' und ')),
  };
}

/**
 * Spans in the bed: from the first week a planting can start until the last one ends.
 * Annuals stay their culture weeks (plus `extraWeeks` when sown directly); plants with years
 * or without end stay for the rest of the year and longer.
 */
function inBed(start: Span, lifecycle: Lifecycle, weeks: number, extraWeeks = 0): Span {
  if (lifecycle.type !== 'ANNUAL') return { from: start.from, to: Math.max(start.to, weeks) };
  return { from: start.from, to: start.to + lifecycle.cultureWeeks + extraWeeks - 1 };
}

/**
 * The bars of the sowing calendar of a plant for `year`: raising seedlings and direct sowing
 * from the week windows, planting out after raising (frost sensitive plants not before the
 * week after the last frost) and the time in the bed until harvest. Null without details.
 */
export function sowingCalendar(
  plant: {
    sowing?: Sowing | undefined;
    frostSensitive?: boolean | undefined;
    lifecycle: Lifecycle;
  },
  { year, lastFrost = DEFAULT_LAST_FROST }: { year: number; lastFrost?: string },
): SowingCalendar | null {
  const { sowing, lifecycle } = plant;
  if (!sowing) return null;
  const weeks = getISOWeeksInYear(new Date(year, 6, 1));
  const rows: CalendarRow[] = [];
  const bed: Span[] = [];

  if (sowing.presowWeeks && sowing.propagationWeeks) {
    const presow = spanOf(sowing.presowWeeks, weeks);
    rows.push(row('presow', [presow], weeks, year));
    const out = {
      from: presow.from + sowing.propagationWeeks.min,
      to: presow.to + sowing.propagationWeeks.max,
    };
    if (plant.frostSensitive) {
      // Not before the frost week of the season the planting out falls into.
      const frost = frostWeek(year, lastFrost);
      const shift = frost - inYear(out.from, weeks);
      if (shift > 0) {
        out.from += shift;
        out.to = Math.max(out.to, out.from);
      }
    }
    // Late windows plant out next year; draw them from the start of the year.
    const offset = out.from - inYear(out.from, weeks);
    const plantOut = { from: out.from - offset, to: out.to - offset };
    rows.push(row('plantOut', [plantOut], weeks, year));
    bed.push(inBed(plantOut, lifecycle, weeks));
  }
  if (sowing.directSowWeeks) {
    const direct = spanOf(sowing.directSowWeeks, weeks);
    rows.push(row('direct', [direct], weeks, year));
    bed.push(inBed(direct, lifecycle, weeks, sowing.directSowExtraWeeks));
  }
  // Plants with years or without end stay: the bar runs from the earliest start to the end.
  const first = Math.min(...bed.map((span) => span.from));
  rows.push(
    row(
      'inBed',
      bed,
      weeks,
      year,
      lifecycle.type === 'ANNUAL'
        ? undefined
        : `ab KW ${String(first)} · ${weekHint(first, { year })}, mehrjährig`,
    ),
  );

  const order: CalendarRowKind[] = ['presow', 'direct', 'plantOut', 'inBed'];
  rows.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  return { year, weeks, rows };
}

/** Position of a segment on the band in percent of its width. */
export function segmentPosition(segment: WeekSegment, weeks: number) {
  return {
    left: ((segment.from - 1) / weeks) * 100,
    width: ((segment.to - segment.from + 1) / weeks) * 100,
  };
}

/** Where each month starts on the band, in percent, aligned with the ISO weeks of `year`. */
export function monthTicks(year: number): { label: string; short: string; left: number }[] {
  const start = startOfISOWeek(new Date(year, 0, 4));
  const days = getISOWeeksInYear(new Date(year, 6, 1)) * 7;
  return Array.from({ length: 12 }, (_, month) => {
    const first = new Date(year, month, 1);
    const label = format(first, 'LLL', { locale: de }).replace('.', '');
    return {
      label,
      short: label.charAt(0),
      left: Math.max(0, (differenceInCalendarDays(first, start) / days) * 100),
    };
  });
}

/** "frostempfindlich, erst nach dem 15. Mai ins Freie" for the frost date `MM-DD`. */
export function frostText(lastFrost = DEFAULT_LAST_FROST): string {
  const date = new Date(`2000-${lastFrost}T12:00:00`);
  return `Frostempfindlich, erst nach dem ${format(date, 'd. MMMM', { locale: de })} ins Freie`;
}
