import { forEachPair, pairNames, type RuleContext, sortedIds } from '../context';
import { EPSILON_CM, type Finding } from '../findings';
import { gap } from '../geometry';
import { intersect } from '../time';

/**
 * Pflanzabstand: warns when the footprints of two plantings overlap while both are in the bed.
 * A row is one footprint, so plants within the same row never warn.
 */
export function spacingRule({ plantings }: RuleContext): Finding[] {
  const findings: Finding[] = [];
  forEachPair(plantings, (a, b) => {
    const period = intersect(a.interval, b.interval);
    if (!period) return;
    const distance = gap(a.footprint, b.footprint);
    if (distance >= -EPSILON_CM) return;

    const overlapCm = Math.max(1, Math.round(-distance));
    findings.push({
      rule: 'SPACING',
      severity: 'WARNING',
      plantingIds: sortedIds(a, b),
      period,
      message: `${pairNames(a, b)} stehen zu eng: Die Standflächen überlappen um ${String(overlapCm)} cm.`,
    });
  });
  return findings;
}
