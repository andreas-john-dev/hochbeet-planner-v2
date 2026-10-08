import type { Plant } from '@hochbeet/contracts';
import type { NeighborRefs, SeedEntry } from './types';

/** Short forms of docs/startkatalog.md that stand for several plants. */
const CABBAGES = [
  'Blumenkohl',
  'Brokkoli',
  'Grünkohl',
  'Rosenkohl',
  'Rotkohl',
  'Weißkohl',
  'Wirsing',
] as const;

const GROUPS: Readonly<Record<string, readonly string[]>> = {
  Kohl: CABBAGES,
  Sellerie: ['Knollensellerie', 'Staudensellerie'],
  Bohnen: ['Buschbohne', 'Stangenbohne'],
};

/** "andere Kohlarten" = all cabbages except the plant itself. */
const OTHER_CABBAGES = 'andere Kohlarten';

export class UnknownNeighborError extends Error {
  constructor(
    readonly plant: string,
    readonly ref: string,
  ) {
    super(`Unknown neighbour "${ref}" in seed plant "${plant}"`);
  }
}

/** Expands "wie X" into the raw list of X. Chains are followed. */
function rawRefs(
  entry: SeedEntry,
  list: 'good' | 'bad',
  byName: ReadonlyMap<string, SeedEntry>,
  seen: ReadonlySet<string> = new Set(),
): readonly string[] {
  const refs: NeighborRefs = entry[list];
  if (!('like' in refs)) return refs;
  const target = byName.get(refs.like);
  if (!target || seen.has(target.name))
    throw new UnknownNeighborError(entry.name, `wie ${refs.like}`);
  return rawRefs(target, list, byName, new Set([...seen, entry.name]));
}

/** Plant names a neighbour list stands for, in source order, without the plant itself. */
export function resolveNames(
  entry: SeedEntry,
  list: 'good' | 'bad',
  byName: ReadonlyMap<string, SeedEntry>,
): string[] {
  const names = rawRefs(entry, list, byName).flatMap((ref) => {
    if (ref === OTHER_CABBAGES) return CABBAGES.filter((name) => name !== entry.name);
    const group = GROUPS[ref];
    if (group) return group;
    if (!byName.has(ref)) throw new UnknownNeighborError(entry.name, ref);
    return [ref];
  });
  return [...new Set(names)].filter((name) => name !== entry.name);
}

/** Turns seed entries into plants with neighbour IDs. Throws on unknown references. */
export function resolveSeed(entries: readonly SeedEntry[]): Plant[] {
  const byName = new Map(entries.map((entry) => [entry.name, entry]));
  const idOf = (name: string) => {
    const entry = byName.get(name);
    if (!entry) throw new Error(`Missing seed plant "${name}"`);
    return entry.id;
  };
  return entries.map((entry) => {
    const { good: _good, bad: _bad, ...fields } = entry;
    return {
      ...fields,
      goodNeighbors: resolveNames(entry, 'good', byName).map(idOf),
      badNeighbors: resolveNames(entry, 'bad', byName).map(idOf),
    };
  });
}
