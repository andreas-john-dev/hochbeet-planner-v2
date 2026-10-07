import type { RuleContext } from '../context';
import { EPSILON_CM, type Finding } from '../findings';
import { bounds } from '../geometry';

/**
 * Beetrand: subtle hint when a footprint reaches beyond the bed, e.g. after the bed was made
 * smaller. Plantings outside stay valid and are kept.
 */
export function bedEdgeRule({ bed, plantings }: RuleContext): Finding[] {
  return plantings.flatMap(({ planting, plant, footprint, interval }) => {
    const box = bounds(footprint);
    const inside =
      box.x0 >= -EPSILON_CM &&
      box.y0 >= -EPSILON_CM &&
      box.x1 <= bed.widthCm + EPSILON_CM &&
      box.y1 <= bed.depthCm + EPSILON_CM;
    if (inside) return [];
    return [
      {
        rule: 'BED_EDGE',
        severity: 'HINT',
        plantingIds: [planting.id],
        period: interval,
        message: `${plant.name} ragt über den Beetrand.`,
      },
    ];
  });
}
