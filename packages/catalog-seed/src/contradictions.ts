import type { Plant } from '@hochbeet/contracts';

/**
 * A pair that one side lists as good and the other (or the same side) as bad.
 * The rules resolve it with "Warnung sticht".
 */
export interface Contradiction {
  /** Plant that lists the pair as good. */
  good: string;
  /** Plant that lists the pair as bad. */
  bad: string;
  /** Both plant names, sorted. */
  pair: [string, string];
}

export function findContradictions(plants: readonly Plant[]): Contradiction[] {
  const byId = new Map(plants.map((plant) => [plant.id, plant]));
  const found = new Map<string, Contradiction>();
  for (const plant of plants) {
    for (const otherId of plant.goodNeighbors) {
      const other = byId.get(otherId);
      if (!other) continue;
      const badSide = plant.badNeighbors.includes(other.id)
        ? plant
        : other.badNeighbors.includes(plant.id)
          ? other
          : undefined;
      if (!badSide) continue;
      const pair = [plant.name, other.name].sort((a, b) => a.localeCompare(b, 'de')) as [
        string,
        string,
      ];
      found.set(`${plant.name}|${badSide.name}|${pair.join('|')}`, {
        good: plant.name,
        bad: badSide.name,
        pair,
      });
    }
  }
  return [...found.values()].sort(
    (a, b) =>
      a.pair[0].localeCompare(b.pair[0], 'de') ||
      a.pair[1].localeCompare(b.pair[1], 'de') ||
      a.good.localeCompare(b.good, 'de'),
  );
}

/** Markdown table of the contradictions, kept as a test report in the repo. */
export function contradictionReport(contradictions: readonly Contradiction[]): string {
  const lines = [
    '# Widersprüche im Startkatalog',
    '',
    'Paare, die eine Sorte als guten und die andere als schlechten Nachbarn führt.',
    'Die Regeln werten sie nach „Warnung sticht“ als schlechte Nachbarn.',
    'Diese Datei wird von `src/index.test.ts` erzeugt und geprüft (`pnpm --filter @hochbeet/catalog-seed test -u`).',
    '',
    `Anzahl: ${String(contradictions.length)}`,
    '',
    '| Paar | Gut laut | Schlecht laut |',
    '| --- | --- | --- |',
    ...contradictions.map((c) => `| ${c.pair.join(' – ')} | ${c.good} | ${c.bad} |`),
  ];
  return `${lines.join('\n')}\n`;
}
