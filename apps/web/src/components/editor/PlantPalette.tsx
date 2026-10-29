import type { Category, Plant } from '@hochbeet/contracts';
import { formatWeek } from '@hochbeet/garden-rules';
import { PlantIcon } from '@hochbeet/plant-icons/react';
import { useDraggable } from '@dnd-kit/core';
import { Search } from 'lucide-react';
import { useId, useState } from 'react';
import { useStore } from 'zustand';
import { Input } from '@/components/ui/input';
import { CATEGORIES, filterPlants } from '@/lib/editor/palette';
import type { PlantingKind } from '@/lib/editor/placement';
import type { EditorStore, PreviewSowing } from '@/lib/editor/store';
import { type AvailableSowing, previewSowing } from '@/lib/sowings';
import { cn } from '@/lib/utils';

const KINDS: readonly { value: PlantingKind; label: string }[] = [
  { value: 'SINGLE', label: 'Einzelpflanze' },
  { value: 'ROW', label: 'Reihe' },
];

/** Small pill buttons for one choice out of a few; `aria-pressed` marks the active one. */
function Choice({
  pressed,
  onClick,
  large,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  /** 44 px high for touch screens. */
  large: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'focus-visible:ring-ring/50 rounded-md px-2.5 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px]',
        large ? 'h-11 px-3' : 'h-9',
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
  /** Set for seedlings from a sowing batch. */
  sowing?: PreviewSowing;
}

const itemClass = (active: boolean, tall = false) =>
  cn(
    'focus-visible:ring-ring/50 flex w-full items-center gap-3 rounded-md px-2 text-left text-sm transition-colors outline-none focus-visible:ring-[3px]',
    tall ? 'min-h-12 py-1' : 'h-11',
    active ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60',
  );

/** Name and, for a sowing batch, its week and free seedlings. */
function ItemLabel({ plant, sowing }: { plant: Plant; sowing: PreviewSowing | undefined }) {
  return (
    <>
      <PlantIcon plant={plant} size={28} decorative />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate">{plant.name}</span>
        {sowing && (
          <span className="text-muted-foreground truncate text-xs">
            {formatWeek(sowing.sowDate).week} · {String(sowing.free)} frei
          </span>
        )}
      </span>
    </>
  );
}

/** Sidebar item: drag it into the bed, or click it to place it with the keyboard. */
function DraggableItem({
  plant,
  sowing,
  active,
  onChoose,
}: {
  plant: Plant;
  sowing?: PreviewSowing;
  active: boolean;
  onChoose: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: sowing ? `sowing-${sowing.id}` : `palette-${plant.id}`,
    data: { plant, ...(sowing ? { sowing } : {}) } satisfies PaletteDragData,
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
        onClick={onChoose}
        className={cn(
          itemClass(active, !!sowing),
          'cursor-grab touch-none active:cursor-grabbing',
          isDragging && 'opacity-50',
        )}
      >
        <ItemLabel plant={plant} sowing={sowing} />
      </button>
    </li>
  );
}

/** Sheet item on phones: a plain button, so that the list scrolls by touch. */
function TapItem({
  plant,
  sowing,
  active,
  onChoose,
}: {
  plant: Plant;
  sowing?: PreviewSowing;
  active: boolean;
  onChoose: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        aria-pressed={active}
        onClick={onChoose}
        className={itemClass(active, !!sowing)}
      >
        <ItemLabel plant={plant} sowing={sowing} />
      </button>
    </li>
  );
}

/**
 * All plants with search, category filter and the choice between a single plant and a row.
 * As desktop sidebar, plants are dragged into the bed or picked for keyboard placement; in
 * the bottom sheet on phones, a tap picks the plant for tap-to-place.
 */
export function PlantPalette({
  plants,
  sowings = [],
  store,
  onChoose,
  variant = 'sidebar',
  className,
}: {
  plants: readonly Plant[];
  /** Sowing batches with free seedlings in the week shown. */
  sowings?: readonly AvailableSowing[];
  store: EditorStore;
  onChoose: (plant: Plant, sowing?: PreviewSowing) => void;
  variant?: 'sidebar' | 'sheet';
  className?: string;
}) {
  const sheet = variant === 'sheet';
  const Item = sheet ? TapItem : DraggableItem;
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category | null>(null);
  const { kind, setKind, preview } = useStore(store);
  const searchId = useId();
  const shown = filterPlants(plants, query, category);

  return (
    <aside
      aria-label="Pflanzen hinzufügen"
      className={cn(
        'flex min-h-0 flex-col gap-3',
        !sheet && 'bg-card rounded-xl border p-3',
        className,
      )}
    >
      {!sheet && <h2 className="text-sm font-semibold">Pflanzen hinzufügen</h2>}
      {sowings.length > 0 && (
        <section aria-labelledby={`${searchId}-sowings`} className="flex flex-col gap-1">
          <h3 id={`${searchId}-sowings`} className="text-muted-foreground text-xs font-medium">
            Aus der Anzucht
          </h3>
          <ul aria-label="Anzuchten" className="-mx-1 flex max-h-40 flex-col overflow-y-auto px-1">
            {sowings.map((available) => {
              const sowing = previewSowing(available);
              return (
                <Item
                  key={sowing.id}
                  plant={available.plant}
                  sowing={sowing}
                  active={preview?.source === 'cursor' && preview.sowing?.id === sowing.id}
                  onChoose={() => {
                    onChoose(available.plant, sowing);
                  }}
                />
              );
            })}
          </ul>
        </section>
      )}
      <div role="group" aria-label="Pflanzart" className="bg-muted flex gap-1 rounded-lg p-1">
        {KINDS.map((k) => (
          <Choice
            key={k.value}
            large={sheet}
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
          large={sheet}
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
            large={sheet}
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
            <Item
              key={plant.id}
              plant={plant}
              active={
                preview?.source === 'cursor' && !preview.sowing && preview.plant.id === plant.id
              }
              onChoose={() => {
                onChoose(plant);
              }}
            />
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">Keine Sorte gefunden.</p>
      )}
      {!sheet && (
        <p className="text-muted-foreground text-xs">
          Ins Beet ziehen oder auswählen und mit Pfeiltasten und Enter setzen.
        </p>
      )}
    </aside>
  );
}
