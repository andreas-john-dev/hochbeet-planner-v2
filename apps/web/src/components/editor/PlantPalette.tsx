import type { Category, Plant } from '@hochbeet/contracts';
import { PlantIcon } from '@hochbeet/plant-icons/react';
import { useDraggable } from '@dnd-kit/core';
import { Search } from 'lucide-react';
import { useId, useState } from 'react';
import { useStore } from 'zustand';
import { Input } from '@/components/ui/input';
import { CATEGORIES, filterPlants } from '@/lib/editor/palette';
import type { PlantingKind } from '@/lib/editor/placement';
import type { EditorStore } from '@/lib/editor/store';
import { cn } from '@/lib/utils';

const KINDS: readonly { value: PlantingKind; label: string }[] = [
  { value: 'SINGLE', label: 'Einzelpflanze' },
  { value: 'ROW', label: 'Reihe' },
];

/** Small pill buttons for one choice out of a few; `aria-pressed` marks the active one. */
function Choice({
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
        'focus-visible:ring-ring/50 h-9 rounded-md px-2.5 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px]',
        pressed
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
      )}
    >
      {children}
    </button>
  );
}

/** Data a palette item hands to the drag & drop handlers. */
export interface PaletteDragData {
  plant: Plant;
}

function PaletteItem({
  plant,
  active,
  onChoose,
}: {
  plant: Plant;
  active: boolean;
  onChoose: (plant: Plant) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${plant.id}`,
    data: { plant } satisfies PaletteDragData,
  });
  return (
    <li>
      <button
        ref={setNodeRef}
        type="button"
        {...attributes}
        {...listeners}
        // dnd-kit makes the item a draggable; it is still a button that picks the plant.
        aria-roledescription={undefined}
        aria-pressed={active}
        onClick={() => {
          onChoose(plant);
        }}
        className={cn(
          'focus-visible:ring-ring/50 flex h-11 w-full cursor-grab touch-none items-center gap-3 rounded-md px-2 text-left text-sm transition-colors outline-none focus-visible:ring-[3px] active:cursor-grabbing',
          active ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60',
          isDragging && 'opacity-50',
        )}
      >
        <PlantIcon plant={plant} size={28} decorative />
        <span className="truncate">{plant.name}</span>
      </button>
    </li>
  );
}

/**
 * Sidebar with all plants: search, category filter and the choice between a single plant
 * and a row. Plants are dragged into the bed or picked for keyboard placement.
 */
export function PlantPalette({
  plants,
  store,
  onChoose,
  className,
}: {
  plants: readonly Plant[];
  store: EditorStore;
  onChoose: (plant: Plant) => void;
  className?: string;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category | null>(null);
  const { kind, setKind, preview } = useStore(store);
  const searchId = useId();
  const shown = filterPlants(plants, query, category);

  return (
    <aside
      aria-label="Pflanzen hinzufügen"
      className={cn('bg-card flex min-h-0 flex-col gap-3 rounded-xl border p-3', className)}
    >
      <h2 className="text-sm font-semibold">Pflanzen hinzufügen</h2>
      <div role="group" aria-label="Pflanzart" className="bg-muted flex gap-1 rounded-lg p-1">
        {KINDS.map((k) => (
          <Choice
            key={k.value}
            pressed={kind === k.value}
            onClick={() => {
              setKind(k.value);
            }}
          >
            {k.label}
          </Choice>
        ))}
      </div>
      <div className="relative">
        <label htmlFor={searchId} className="sr-only">
          Sorte suchen
        </label>
        <Search
          aria-hidden
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        />
        <Input
          id={searchId}
          type="search"
          placeholder="Sorte suchen"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          className="pl-9"
        />
      </div>
      <div role="group" aria-label="Kategorie" className="flex flex-wrap gap-1">
        <Choice
          pressed={category === null}
          onClick={() => {
            setCategory(null);
          }}
        >
          Alle
        </Choice>
        {CATEGORIES.map((c) => (
          <Choice
            key={c.value}
            pressed={category === c.value}
            onClick={() => {
              setCategory(c.value);
            }}
          >
            {c.label}
          </Choice>
        ))}
      </div>
      {shown.length > 0 ? (
        <ul aria-label="Sorten" className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
          {shown.map((plant) => (
            <PaletteItem
              key={plant.id}
              plant={plant}
              active={preview?.source === 'cursor' && preview.plant.id === plant.id}
              onChoose={onChoose}
            />
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">Keine Sorte gefunden.</p>
      )}
      <p className="text-muted-foreground text-xs">
        Ins Beet ziehen oder auswählen und mit Pfeiltasten und Enter setzen.
      </p>
    </aside>
  );
}
