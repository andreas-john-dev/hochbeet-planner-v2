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

/** Neighbour names of every entry as written on its own side, after expanding short forms. */
function ownLists(entries: readonly SeedEntry[], byName: ReadonlyMap<string, SeedEntry>) {
  return new Map(
    entries.map((entry) => [
      entry.name,
      {
        good: resolveNames(entry, 'good', byName),
        bad: resolveNames(entry, 'bad', byName),
      },
    ]),
  );
}

type Lists = ReadonlyMap<string, { good: readonly string[]; bad: readonly string[] }>;

/**
 * Makes the lists symmetric: a plant also gets every plant that lists it, in catalogue order
 * after its own entries. "Warnung sticht": a pair that is bad on either side is never good.
 */
function symmetric(entries: readonly SeedEntry[], own: Lists): Lists {
  const listing = (name: string, list: 'good' | 'bad') =>
    entries.filter((other) => own.get(other.name)?.[list].includes(name)).map((e) => e.name);
  return new Map(
    entries.map((entry) => {
      const lists = own.get(entry.name) ?? { good: [], bad: [] };
      const bad = [...new Set([...lists.bad, ...listing(entry.name, 'bad')])];
      const good = [...new Set([...lists.good, ...listing(entry.name, 'good')])].filter(
        (name) => !bad.includes(name),
      );
      return [entry.name, { good, bad }];
    }),
  );
}

function toPlants(entries: readonly SeedEntry[], lists: Lists): Plant[] {
  const byName = new Map(entries.map((entry) => [entry.name, entry]));
  const idOf = (name: string) => {
    const entry = byName.get(name);
    if (!entry) throw new Error(`Missing seed plant "${name}"`);
    return entry.id;
  };
  return entries.map((entry) => {
    const { good: _good, bad: _bad, ...fields } = entry;
    const { good, bad } = lists.get(entry.name) ?? { good: [], bad: [] };
    return { ...fields, goodNeighbors: good.map(idOf), badNeighbors: bad.map(idOf) };
  });
}

/**
 * Plants with only the neighbours each entry names itself (no symmetry, no "Warnung sticht").
 * Basis of the contradiction report, which compares both sides of a pair.
 */
export function resolveOneSided(entries: readonly SeedEntry[]): Plant[] {
  const byName = new Map(entries.map((entry) => [entry.name, entry]));
  return toPlants(entries, ownLists(entries, byName));
}

/**
 * Turns seed entries into plants with neighbour IDs. Neighbourhood is symmetric, so every plant
 * carries the pairs named on either side (catalogue, assistant and rules agree). Throws on
 * unknown references.
 */
export function resolveSeed(entries: readonly SeedEntry[]): Plant[] {
  const byName = new Map(entries.map((entry) => [entry.name, entry]));
  return toPlants(entries, symmetric(entries, ownLists(entries, byName)));
}
