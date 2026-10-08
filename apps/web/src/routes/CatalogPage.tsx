import type { Category, Feeder } from '@hochbeet/contracts';
import { PlantIcon } from '@hochbeet/plant-icons/react';
import { Link } from '@tanstack/react-router';
import { Search } from 'lucide-react';
import { useId, useState } from 'react';
import { SourceBadge } from '@/components/catalog/SourceBadge';
import { FormMessage } from '@/components/FormField';
import { PageHeader } from '@/components/layout/PageHeader';
import { Input } from '@/components/ui/input';
import {
  CATEGORY_LABEL,
  type CatalogFilter,
  families,
  FEEDER_LABEL,
  filterCatalog,
  NO_FILTER,
} from '@/lib/catalog';
import { usePlants } from '@/lib/garden';
import { cn } from '@/lib/utils';

/** One option of a filter group; pressed when active. */
function Chip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'focus-visible:ring-ring/50 h-11 rounded-full border px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] md:h-9',
        pressed
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-card hover:bg-accent text-muted-foreground',
      )}
    >
      {children}
    </button>
  );
}

/** The user's catalogue: global plants (possibly adjusted) and own plants, searchable. */
export function CatalogPage() {
  const plants = usePlants();
  const [filter, setFilter] = useState<CatalogFilter>(NO_FILTER);
  const searchId = useId();
  const familyId = useId();
  const all = plants.data ?? [];
  const shown = filterCatalog(all, filter);
  const update = (change: Partial<CatalogFilter>) => {
    setFilter((current) => ({ ...current, ...change }));
  };

  return (
    <>
      <PageHeader
        title="Pflanzenkatalog"
        description="Gemüse, Obst und Kräuter mit Abständen, Standzeit und Nachbarn."
      />
      <div className="flex flex-col gap-3" role="search" aria-label="Sorten filtern">
        <div className="relative">
          <label htmlFor={searchId} className="sr-only">
            Sorte oder Familie suchen
          </label>
          <Search
            aria-hidden
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          />
          <Input
            id={searchId}
            type="search"
            placeholder="Sorte oder Familie suchen"
            value={filter.query}
            onChange={(event) => {
              update({ query: event.target.value });
            }}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Kategorie">
          <Chip
            pressed={filter.category === null}
            onClick={() => {
              update({ category: null });
            }}
          >
            Alle
          </Chip>
          {(Object.keys(CATEGORY_LABEL) as Category[]).map((category) => (
            <Chip
              key={category}
              pressed={filter.category === category}
              onClick={() => {
                update({ category });
              }}
            >
              {CATEGORY_LABEL[category]}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Bedarf">
            {(Object.keys(FEEDER_LABEL) as Feeder[]).map((feeder) => (
              <Chip
                key={feeder}
                pressed={filter.feeder === feeder}
                onClick={() => {
                  update({ feeder: filter.feeder === feeder ? null : feeder });
                }}
              >
                {FEEDER_LABEL[feeder]}
              </Chip>
            ))}
          </div>
          <label htmlFor={familyId} className="sr-only">
            Familie
          </label>
          <select
            id={familyId}
            value={filter.family ?? ''}
            onChange={(event) => {
              update({ family: event.target.value === '' ? null : event.target.value });
            }}
            className="bg-card focus-visible:ring-ring/50 h-11 rounded-md border px-3 text-base outline-none focus-visible:ring-[3px] md:h-9 md:text-sm"
          >
            <option value="">Alle Familien</option>
            {families(all).map((family) => (
              <option key={family} value={family}>
                {family}
              </option>
            ))}
          </select>
        </div>
      </div>

      {plants.isError ? (
        <div className="mt-6">
          <FormMessage tone="error">
            Der Katalog konnte nicht geladen werden. Bitte lade die Seite neu.
          </FormMessage>
        </div>
      ) : (
        <>
          <p className="text-muted-foreground mt-4 mb-2 text-sm" aria-live="polite">
            {plants.isPending
              ? 'Katalog wird geladen …'
              : `${String(shown.length)} ${shown.length === 1 ? 'Sorte' : 'Sorten'}`}
          </p>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-label="Sorten">
            {shown.map((plant) => (
              <li key={plant.id}>
                <Link
                  to="/katalog/$plantId"
                  params={{ plantId: plant.id }}
                  className="bg-card hover:bg-accent focus-visible:ring-ring/50 flex min-h-16 items-center gap-3 rounded-xl border p-3 outline-none focus-visible:ring-[3px]"
                >
                  <PlantIcon plant={plant} size={40} decorative />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-medium">{plant.name}</span>
                      <SourceBadge plant={plant} />
                    </span>
                    <span className="text-muted-foreground truncate text-xs">
                      {plant.family} · {FEEDER_LABEL[plant.feeder]}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {!plants.isPending && shown.length === 0 && (
            <p className="text-muted-foreground mt-6 text-center text-sm">
              Keine Sorte passt zu Suche und Filtern.
            </p>
          )}
        </>
      )}
    </>
  );
}
