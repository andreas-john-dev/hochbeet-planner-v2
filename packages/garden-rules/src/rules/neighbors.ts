import { INFLUENCE_RADIUS_CM } from '../constants';
import {
  forEachPair,
  pairNames,
  type ResolvedPlanting,
  type RuleContext,
  sortedIds,
} from '../context';
import type { Finding } from '../findings';
import { gap } from '../geometry';
import { intersect } from '../time';

/** True when either plant lists the other in the given list (evaluated symmetrically). */
function listed(a: ResolvedPlanting, b: ResolvedPlanting, list: 'goodNeighbors' | 'badNeighbors') {
  return a.plant[list].includes(b.plant.id) || b.plant[list].includes(a.plant.id);
}

/**
 * Nachbarschaft: within the influence radius, bad neighbours warn and good neighbours get a
 * positive hint. "Warnung sticht": once either side marks the pair as bad, there is no
 * positive hint, even if the other side lists it as good.
 */
export function neighborsRule({ plantings }: RuleContext): Finding[] {
  const findings: Finding[] = [];
  forEachPair(plantings, (a, b) => {
    const bad = listed(a, b, 'badNeighbors');
    const good = !bad && listed(a, b, 'goodNeighbors');
    if (!bad && !good) return;

    const period = intersect(a.interval, b.interval);
    if (!period || gap(a.footprint, b.footprint) >= INFLUENCE_RADIUS_CM) return;

    const names = pairNames(a, b);
    findings.push(
      bad
        ? {
            rule: 'BAD_NEIGHBOR',
            severity: 'WARNING',
            plantingIds: sortedIds(a, b),
            period,
            message: `${names} sind schlechte Nachbarn.`,
          }
        : {
            rule: 'GOOD_NEIGHBOR',
            severity: 'POSITIVE',
            plantingIds: sortedIds(a, b),
            period,
            message: `${names} sind gute Nachbarn.`,
          },
    );
  });
  return findings;
}
