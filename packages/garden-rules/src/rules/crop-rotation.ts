import type { IsoDate } from '@hochbeet/contracts';
import type { ResolvedPlanting, RuleContext } from '../context';
import type { Finding } from '../findings';
import { cellKey, gridCells } from '../geometry';
import { hasSoilRenewalBetween } from '../time';

const sameFamily = (a: ResolvedPlanting, b: ResolvedPlanting) =>
  a.plant.family.trim().toLowerCase() === b.plant.family.trim().toLowerCase();

interface Ended {
  item: ResolvedPlanting;
  end: IsoDate;
}

/** Plantings on a cell that ended on or before `start`; perennials without end never qualify. */
function endedBefore(
  items: readonly ResolvedPlanting[],
  start: IsoDate,
  except: ResolvedPlanting,
): Ended[] {
  return items.flatMap((item) => {
    const { end } = item.interval;
    return item !== except && end !== null && end <= start ? [{ item, end }] : [];
  });
}

/**
 * Fruchtfolge: for every 5 cm cell of a planting, its direct predecessor is the planting on
 * that cell that ended last before it started. A predecessor of the same family warns, unless
 * the soil was renewed in between. A planting of another family in between breaks the chain,
 * but only on the cells it covers: one cell is enough for a warning.
 */
export function cropRotationRule({ bed, plantings }: RuleContext): Finding[] {
  const cellsOf = new Map(plantings.map((item) => [item, gridCells(item.footprint).map(cellKey)]));
  const onCell = new Map<string, ResolvedPlanting[]>();
  for (const [item, cells] of cellsOf) {
    for (const cell of cells) {
      const list = onCell.get(cell);
      if (list) list.push(item);
      else onCell.set(cell, [item]);
    }
  }

  const findings: Finding[] = [];
  for (const [successor, cells] of cellsOf) {
    const start = successor.interval.start;
    const offenders = new Set<ResolvedPlanting>();

    for (const cell of cells) {
      const predecessors = endedBefore(onCell.get(cell) ?? [], start, successor);
      if (predecessors.length === 0) continue;
      const lastEnd = predecessors.reduce((max, { end }) => (end > max ? end : max), '');
      for (const { item, end } of predecessors) {
        if (
          end === lastEnd &&
          sameFamily(item, successor) &&
          !hasSoilRenewalBetween(bed, end, start)
        ) {
          offenders.add(item);
        }
      }
    }

    for (const predecessor of offenders) {
      findings.push({
        rule: 'CROP_ROTATION',
        severity: 'WARNING',
        plantingIds: [predecessor.planting.id, successor.planting.id].sort(),
        period: successor.interval,
        message: `${successor.plant.name} folgt am selben Platz direkt auf ${predecessor.plant.name} (beide ${successor.plant.family}) ohne Erneuerung der Erde.`,
      });
    }
  }
  return findings;
}
