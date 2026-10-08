import type { CatalogPlant } from '@hochbeet/contracts';
import { PlantIcon } from '@hochbeet/plant-icons/react';
import { Plus, X } from 'lucide-react';
import { useId, useState } from 'react';
import { Input } from '@/components/ui/input';
import { filterCatalog, NO_FILTER } from '@/lib/catalog';
import { cn } from '@/lib/utils';

const MAX_RESULTS = 6;

/** Chooses neighbours by search: chosen ones as removable chips, matches as add buttons. */
export function NeighborPicker({
  label,
  tone,
  value,
  candidates,
  onChange,
}: {
  label: string;
  tone: 'good' | 'bad';
  value: readonly string[];
  /** Plants that may be added: the catalogue without the plant itself and the other list. */
  candidates: readonly CatalogPlant[];
  onChange: (ids: string[]) => void;
}) {
  const searchId = useId();
  const [query, setQuery] = useState('');
  const chosen = value.flatMap((id) => candidates.find((p) => p.id === id) ?? []);
  const matches =
    query.trim() === ''
      ? []
      : filterCatalog(candidates, { ...NO_FILTER, query })
          .filter((p) => !value.includes(p.id))
          .slice(0, MAX_RESULTS);

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">{label}</legend>
      {chosen.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label={label}>
          {chosen.map((plant) => (
            <li key={plant.id}>
              <button
                type="button"
                aria-label={`${plant.name} entfernen`}
                onClick={() => {
                  onChange(value.filter((id) => id !== plant.id));
                }}
                className={cn(
                  'focus-visible:ring-ring/50 inline-flex min-h-11 items-center gap-2 rounded-full border py-1 pr-2 pl-1 text-sm outline-none focus-visible:ring-[3px] md:min-h-9',
                  tone === 'good'
                    ? 'border-green-300 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950/40 dark:text-green-200'
                    : 'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200',
                )}
              >
                <PlantIcon plant={plant} size={24} decorative />
                {plant.name}
                <X aria-hidden className="size-4 opacity-70" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <label htmlFor={searchId} className="sr-only">
        {label} suchen
      </label>
      <Input
        id={searchId}
        type="search"
        placeholder="Sorte suchen und hinzufügen"
        autoComplete="off"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
        }}
      />
      {matches.length > 0 && (
        <ul className="flex flex-col" aria-label={`Treffer für ${label}`}>
          {matches.map((plant) => (
            <li key={plant.id}>
              <button
                type="button"
                onClick={() => {
                  onChange([...value, plant.id]);
                  setQuery('');
                }}
                className="hover:bg-accent focus-visible:ring-ring/50 flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-left text-sm outline-none focus-visible:ring-[3px]"
              >
                <PlantIcon plant={plant} size={24} decorative />
                <span className="flex-1">{plant.name}</span>
                <Plus aria-hidden className="text-muted-foreground size-4" />
                <span className="sr-only">hinzufügen</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}
