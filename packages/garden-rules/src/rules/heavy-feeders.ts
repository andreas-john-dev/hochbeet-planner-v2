import type { Direction } from '@hochbeet/contracts';
import { INFLUENCE_RADIUS_CM } from '../constants';
import {
  forEachPair,
  pairNames,
  type ResolvedPlanting,
  type RuleContext,
  sortedIds,
} from '../context';
import { EPSILON_CM, type Finding } from '../findings';
import { bounds, rowDirection } from '../geometry';
import { intersect } from '../time';

interface Span {
  min: number;
  max: number;
}

/** Extent of a footprint along (`along`) and across (`across`) the given row direction. */
function spans(item: ResolvedPlanting, direction: Direction): { along: Span; across: Span } {
  const box = bounds(item.footprint);
  const x = { min: box.x0, max: box.x1 };
  const y = { min: box.y0, max: box.y1 };
  // H rows run along x, V rows along y.
  return direction === 'H' ? { along: x, across: y } : { along: y, across: x };
}

/** Distance between two 1-D extents; negative when they overlap. */
const spanGap = (a: Span, b: Span) => Math.max(b.min - a.max, a.min - b.max);

/**
 * Seen along `direction`: side by side means the footprints overlap along the row and are
 * separated across it by less than the influence radius. Returns that gap, or null when the
 * plantings are one behind the other (head end) or too far apart.
 *
 * Footprints that overlap on both axes are not reported here; the spacing rule warns for them.
 */
function sideBySideGap(
  a: ResolvedPlanting,
  b: ResolvedPlanting,
  direction: Direction,
): number | null {
  const sa = spans(a, direction);
  const sb = spans(b, direction);
  const overlapAlong = -spanGap(sa.along, sb.along);
  const gapAcross = spanGap(sa.across, sb.across);
  if (overlapAlong <= EPSILON_CM) return null; // behind each other
  if (gapAcross < -EPSILON_CM || gapAcross >= INFLUENCE_RADIUS_CM) return null;
  return Math.max(0, gapAcross);
}

/**
 * Starkzehrer: two heavy feeders must not stand side by side across the row direction with
 * less than 30 cm gap. One behind the other along a row is fine (three broccoli in a row).
 * Each planting is seen along its own row direction (rows: orientation, single plants: the
 * bed's main direction); when the two differ, either view can trigger the warning.
 */
export function heavyFeedersRule({ bed, plantings }: RuleContext): Finding[] {
  const heavy = plantings.filter((item) => item.plant.feeder === 'STARK');
  const findings: Finding[] = [];
  forEachPair(heavy, (a, b) => {
    const period = intersect(a.interval, b.interval);
    if (!period) return;

    const directions = new Set([rowDirection(a.planting, bed), rowDirection(b.planting, bed)]);
    const gaps = [...directions]
      .map((direction) => sideBySideGap(a, b, direction))
      .filter((value) => value !== null);
    if (gaps.length === 0) return;

    const gapCm = Math.round(Math.min(...gaps));
    findings.push({
      rule: 'HEAVY_FEEDER',
      severity: 'WARNING',
      plantingIds: sortedIds(a, b),
      period,
      message: `${pairNames(a, b)} sind Starkzehrer und stehen mit ${String(gapCm)} cm Lücke nebeneinander (mindestens ${String(INFLUENCE_RADIUS_CM)} cm empfohlen).`,
    });
  });
  return findings;
}
