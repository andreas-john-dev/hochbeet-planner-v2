import type { RuleContext } from '../context';
import type { Finding } from '../findings';
import { lastFrostDate } from '../time';

/**
 * Frost: subtle hint when a frost sensitive plant goes into the bed (sown or planted out) on
 * or before the last frost of that year. Only the start counts, so a planting that starts
 * after the frost and stays over winter gets no hint.
 */
export function frostRule({ plantings, lastFrost, texts, plantName }: RuleContext): Finding[] {
  return plantings.flatMap(({ planting, plant, interval }) => {
    if (!plant.frostSensitive) return [];
    const frost = lastFrostDate({ lastFrost }, Number(planting.startDate.slice(0, 4)));
    if (planting.startDate > frost) return [];
    const params = { plant: plantName(plant), lastFrost };
    return [
      {
        rule: 'FROST',
        severity: 'HINT',
        plantingIds: [planting.id],
        period: interval,
        params,
        message: texts.findings.FROST(params),
      },
    ];
  });
}
