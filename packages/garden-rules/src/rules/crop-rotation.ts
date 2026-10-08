import type { IsoDate } from '@hochbeet/contracts';
import type { ResolvedPlanting, RuleContext } from '../context';
import type { Finding } from '../findings';
import { cellIndex, forEachGridCell } from '../geometry';
import { hasSoilRenewalBetween } from '../time';

/** Family compared ignoring case and surrounding spaces. */
const familyKey = (item: ResolvedPlanting) => item.plant.family.trim().toLowerCase();

interface Ended {
  item: ResolvedPlanting;
  end: IsoDate;
  family: string;
}

/**
 * Fruchtfolge: for every 5 cm cell of a planting, its direct predecessor is the planting on
 * that cell that ended last before it started. A predecessor of the same family warns, unless
 * the soil was renewed in between. A planting of another family in between breaks the chain,
 * but only on the cells it covers: one cell is enough for a warning.
 */
export function cropRotationRule({ bed, plantings }: RuleContext): Finding[] {
  const cellsOf = new Map(
    plantings.map((item) => {
      const cells: number[] = [];
      forEachGridCell(item.footprint, (col, row) => cells.push(cellIndex(col, row)));
      return [item, cells];
    }),
  );

  // Per cell: plantings that have an end (perennials never become predecessors), latest first.
  const endedOnCell = new Map<number, Ended[]>();
  for (const [item, cells] of cellsOf) {
    const { end } = item.interval;
    if (end === null) continue;
    // One entry per planting, shared by all its cells, so sets below deduplicate plantings.
    const entry: Ended = { item, end, family: familyKey(item) };
    for (const cell of cells) {
      const list = endedOnCell.get(cell);
      if (list) list.push(entry);
      else endedOnCell.set(cell, [entry]);
    }
  }
  for (const list of endedOnCell.values())
    list.sort((a, b) => (a.end < b.end ? 1 : a.end > b.end ? -1 : 0));

  const findings: Finding[] = [];
  for (const [successor, cells] of cellsOf) {
    const start = successor.interval.start;

    // Direct predecessors over all cells: on each cell the entries ending last on or before
    // the start (several if they end on the same day).
    const direct = new Set<Ended>();
    for (const cell of cells) {
      const list = endedOnCell.get(cell);
      if (!list) continue;
      let lastEnd: IsoDate | undefined;
      for (const entry of list) {
        if (entry.end > start || entry.item === successor) continue;
        if (lastEnd !== undefined && entry.end !== lastEnd) break;
        lastEnd = entry.end;
        direct.add(entry);
      }
    }

    // Family and soil renewal are checked once per pair, not per cell.
    const family = familyKey(successor);
    const offenders: ResolvedPlanting[] = [];
    for (const entry of direct) {
      if (entry.family === family && !hasSoilRenewalBetween(bed, entry.end, start)) {
        offenders.push(entry.item);
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
