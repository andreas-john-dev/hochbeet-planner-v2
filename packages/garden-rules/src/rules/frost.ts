import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import type { RuleContext } from '../context';
import type { Finding } from '../findings';
import { lastFrostDate } from '../time';

/** "15. Mai" for `MM-DD`. */
function dayText(lastFrost: string): string {
  const [month = 1, day = 1] = lastFrost.split('-').map(Number);
  return format(new Date(2001, month - 1, day), 'd. MMMM', { locale: de });
}

/**
 * Frost: subtle hint when a frost sensitive plant goes into the bed (sown or planted out) on
 * or before the last frost of that year. Only the start counts, so a planting that starts
 * after the frost and stays over winter gets no hint.
 */
export function frostRule({ plantings, lastFrost }: RuleContext): Finding[] {
  return plantings.flatMap(({ planting, plant, interval }) => {
    if (!plant.frostSensitive) return [];
    const frost = lastFrostDate({ lastFrost }, Number(planting.startDate.slice(0, 4)));
    if (planting.startDate > frost) return [];
    return [
      {
        rule: 'FROST',
        severity: 'HINT',
        plantingIds: [planting.id],
        period: interval,
        message: `${plant.name} ist frostempfindlich und sollte erst nach dem ${dayText(lastFrost)} ins Beet.`,
      },
    ];
  });
}
