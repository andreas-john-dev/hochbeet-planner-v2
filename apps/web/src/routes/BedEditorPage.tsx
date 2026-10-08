import type { Bed, Plant, Planting } from '@hochbeet/contracts';
import { formatWeek } from '@hochbeet/garden-rules';
import { PlantIcon } from '@hochbeet/plant-icons/react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragMoveEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { Link, useParams } from '@tanstack/react-router';
import { ArrowLeft, Maximize, MapPinOff, Minus, Plus, Redo2, Undo2 } from 'lucide-react';
import { useEffect, useEffectEvent, useId, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { BedCanvas } from '@/components/editor/BedCanvas';
import { PlantingDetails } from '@/components/editor/PlantingDetails';
import { PlantPalette, type PaletteDragData } from '@/components/editor/PlantPalette';
import { EmptyState } from '@/components/EmptyState';
import { FormMessage } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { ApiError, apiErrorMessage } from '@/lib/api';
import { activePlantings } from '@/lib/active-plantings';
import type { Change, Step } from '@/lib/editor/history';
import { bedCentre, isTempId, newPlanting, snapToBed } from '@/lib/editor/placement';
import { createEditorStore, type EditorStore } from '@/lib/editor/store';
import { toCm } from '@/lib/editor/viewport';
import { useBedWithPlantings, useDeletePlanting, usePlants, useSavePlanting } from '@/lib/garden';

const ZOOM_STEP = 1.4;

/** Route component for /beete/$bedId; remounts per bed so the editor state starts fresh. */
export function BedEditorPage() {
  const bedId = bedIdParam(useParams({ strict: false }));
  return <BedEditor key={bedId} bedId={bedId} />;
}

// Params are untyped here: typing them via the route would make router.tsx circular.
function bedIdParam(params: unknown): string {
  const value = (params as { bedId?: unknown } | null)?.bedId;
  return typeof value === 'string' ? value : '';
}

/** Bed editor: the bed true to scale with grid, plantings of the current week, zoom and pan. */
function BedEditor({ bedId }: { bedId: string }) {
  const details = useBedWithPlantings(bedId);
  const plants = usePlants();
  const [store] = useState(createEditorStore);
  const [today] = useState(() => new Date());
  const { range, week } = formatWeek(today);
  const save = useSavePlanting(bedId);
  const remove = useDeletePlanting(bedId);
  const { history } = useStore(store);
  // Undo and redo wait for running requests, so that temporary ids are resolved first.
  const busy = save.isPending || remove.isPending;
  const error = save.error ?? remove.error;

  /** Sends what turns `current` into `target`: create, change or delete. */
  const apply = ({ target, current }: Step) => {
    if (target && current) {
      save.mutate({ planting: target, isNew: false });
    } else if (target) {
      save.mutate(
        { planting: target, isNew: true },
        // The server assigns the real id; the history and the selection follow it.
        {
          onSuccess: (created) => {
            store.getState().remapId(target.id, created.id);
          },
        },
      );
    } else if (current) {
      remove.mutate(current.id);
    }
  };

  /** A change made by the user: saved right away and undoable. */
  const commit = (change: Change) => {
    // A planting that is still being created cannot be changed yet.
    if (change.before && isTempId(change.before.id)) return;
    store.getState().record(change);
    apply({ target: change.after, current: change.before });
  };

  const travel = (direction: 'undo' | 'redo') => {
    if (busy) return;
    const state = store.getState();
    const step = direction === 'undo' ? state.undo() : state.redo();
    if (!step) return;
    state.select(step.target?.id ?? null);
    apply(step);
  };

  // Ctrl+Z / Cmd+Z undoes, with Shift (or Ctrl+Y) redoes; text fields keep their own undo.
  const onShortcut = useEffectEvent((event: KeyboardEvent) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key !== 'z' && key !== 'y') return;
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      target.closest('input, textarea, select, [contenteditable]')
    )
      return;
    event.preventDefault();
    travel(key === 'y' || event.shiftKey ? 'redo' : 'undo');
  });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      onShortcut(event);
    };
    window.addEventListener('keydown', listener);
    return () => {
      window.removeEventListener('keydown', listener);
    };
  }, []);

  const backLink = (
    <Link
      to="/beete"
      className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-sm"
    >
      <ArrowLeft className="size-4" aria-hidden />
      Alle Beete
    </Link>
  );

  if (details.isError) {
    const notFound = details.error instanceof ApiError && details.error.status === 404;
    return (
      <div className="flex flex-col gap-6">
        {backLink}
        {notFound ? (
          <EmptyState icon={MapPinOff} title="Beet nicht gefunden">
            Dieses Beet gibt es nicht oder nicht mehr.
          </EmptyState>
        ) : (
          <FormMessage tone="error">
            Das Beet konnte nicht geladen werden. Bitte lade die Seite neu.
          </FormMessage>
        )}
      </div>
    );
  }

  const bed = details.data?.bed;
  const shown = activePlantings(details.data?.plantings ?? [], plants.data ?? [], today);

  return (
    <div className="flex flex-col gap-4">
      {backLink}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="truncate text-2xl font-semibold tracking-tight md:text-3xl">
            {bed?.name ?? 'Beet'}
          </h1>
          <p className="text-muted-foreground text-sm">
            {bed && `${String(bed.widthCm)} × ${String(bed.depthCm)} cm · `}
            {range} <span className="text-xs">{week}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex gap-2" role="toolbar" aria-label="Bearbeiten">
            <Button
              variant="outline"
              size="icon"
              aria-label="Rückgängig"
              title="Rückgängig (Strg+Z)"
              aria-keyshortcuts="Control+Z"
              disabled={busy || history.past.length === 0}
              onClick={() => {
                travel('undo');
              }}
            >
              <Undo2 />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Wiederholen"
              title="Wiederholen (Strg+Umschalt+Z)"
              aria-keyshortcuts="Control+Shift+Z"
              disabled={busy || history.future.length === 0}
              onClick={() => {
                travel('redo');
              }}
            >
              <Redo2 />
            </Button>
          </div>
          <div className="flex gap-2" role="toolbar" aria-label="Ansicht">
            <Button
              variant="outline"
              size="icon"
              aria-label="Verkleinern"
              onClick={() => {
                store.getState().zoomBy(1 / ZOOM_STEP);
              }}
            >
              <Minus />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Vergrößern"
              onClick={() => {
                store.getState().zoomBy(ZOOM_STEP);
              }}
            >
              <Plus />
            </Button>
            <Button
              variant="outline"
              className="h-11"
              disabled={!bed}
              onClick={() => {
                if (bed) store.getState().fit(bed);
              }}
            >
              <Maximize aria-hidden />
              Auf Beet einpassen
            </Button>
          </div>
        </div>
      </div>
      {bed && plants.data ? (
        <Workspace
          bed={bed}
          plants={plants.data}
          plantings={shown}
          store={store}
          today={today}
          onCommit={commit}
        />
      ) : (
        <div
          className="bg-muted h-[60dvh] min-h-72 animate-pulse rounded-xl border md:h-[65dvh]"
          aria-busy="true"
        >
          <span className="sr-only">Beet wird geladen …</span>
        </div>
      )}
      {error && <FormMessage tone="error">{apiErrorMessage(error)}</FormMessage>}
    </div>
  );
}

const announcements: Announcements = {
  onDragStart: ({ active }) => `${plantName(active.data.current)} aufgenommen.`,
  onDragOver: ({ active, over }) =>
    over ? `${plantName(active.data.current)} über dem Beet.` : undefined,
  onDragEnd: ({ active }) => `${plantName(active.data.current)} abgelegt.`,
  onDragCancel: ({ active }) => `Ziehen von ${plantName(active.data.current)} abgebrochen.`,
};

function plantName(data: unknown) {
  return (data as PaletteDragData | undefined)?.plant.name ?? 'Pflanze';
}

/** Client coordinates where a pointer drag currently is. */
function dragPoint(event: DragMoveEvent) {
  const start = event.activatorEvent;
  if (!(start instanceof PointerEvent || start instanceof MouseEvent)) return null;
  return { x: start.clientX + event.delta.x, y: start.clientY + event.delta.y };
}

/** Palette and canvas with drag & drop and keyboard placement in between. */
function Workspace({
  bed,
  plants,
  plantings,
  store,
  today,
  onCommit,
}: {
  bed: Bed;
  plants: readonly Plant[];
  plantings: readonly { planting: Planting; plant: Plant }[];
  store: EditorStore;
  today: Date;
  onCommit: (change: Change) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const hintId = useId();
  const [dragged, setDragged] = useState<Plant | null>(null);
  const { preview, kind, selectedId } = useStore(store);
  // A short move starts a drag; a plain click on a palette item picks the plant.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const place = (plant: Plant, at: { x: number; y: number }) => {
    const state = store.getState();
    const planting = newPlanting({ bed, plant, kind: state.kind, at, today });
    state.setPreview(null);
    // Rows get selected for their length handle; after a single plant the palette stays.
    state.select(planting.kind === 'ROW' ? planting.id : null);
    onCommit({ before: null, after: planting });
  };

  const change = (before: Planting, after: Planting) => {
    onCommit({ before, after });
  };

  const remove = (planting: Planting) => {
    store.getState().select(null);
    onCommit({ before: planting, after: null });
  };

  const selected = plantings.find(({ planting }) => planting.id === selectedId);

  /** Grid point in the bed for a screen point, or null outside the drawing area. */
  const bedPointAt = (client: { x: number; y: number }) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (
      !rect ||
      client.x < rect.left ||
      client.x > rect.right ||
      client.y < rect.top ||
      client.y > rect.bottom
    ) {
      return null;
    }
    const cm = toCm(store.getState().viewport, { x: client.x - rect.left, y: client.y - rect.top });
    return snapToBed(cm, bed);
  };

  const onDragStart = (event: DragStartEvent) => {
    const plant = (event.active.data.current as PaletteDragData | undefined)?.plant ?? null;
    setDragged(plant);
    store.getState().setPreview(null);
  };

  const onDragMove = (event: DragMoveEvent) => {
    const point = dragPoint(event);
    const at = point && bedPointAt(point);
    const state = store.getState();
    if (!dragged || !at) {
      if (state.preview) state.setPreview(null);
      return;
    }
    const current = state.preview;
    if (current?.at.x !== at.x || current.at.y !== at.y) {
      state.setPreview({ plant: dragged, at, source: 'drag' });
    }
  };

  const onDragEnd = () => {
    const current = store.getState().preview;
    if (current?.source === 'drag') place(current.plant, current.at);
    setDragged(null);
  };

  const onDragCancel = () => {
    store.getState().setPreview(null);
    setDragged(null);
  };

  const choose = (plant: Plant) => {
    const state = store.getState();
    const at = state.preview?.at ?? bedCentre(bed);
    state.setPreview({ plant, at, source: 'cursor' });
    svgRef.current?.focus();
  };

  const placing = preview?.source === 'cursor' ? preview : null;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            'Mit der Maus ins Beet ziehen. Mit Enter auswählen und im Beet mit den Pfeiltasten setzen.',
        },
      }}
    >
      <div className="flex flex-col gap-4 md:h-[65dvh] md:flex-row">
        {selected ? (
          <PlantingDetails
            // Fresh form state for another planting or after undo.
            key={`${selected.planting.id}-${selected.planting.endDate ?? ''}`}
            planting={selected.planting}
            plant={selected.plant}
            week={today}
            onChange={change}
            onDelete={remove}
            onClose={() => {
              store.getState().select(null);
            }}
            className="hidden w-72 shrink-0 md:flex"
          />
        ) : (
          <PlantPalette
            plants={plants}
            store={store}
            onChoose={choose}
            className="hidden w-72 shrink-0 md:flex"
          />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="bg-card h-[60dvh] min-h-72 overflow-hidden rounded-xl border md:h-auto md:flex-1">
            <BedCanvas
              bed={bed}
              plantings={plantings}
              store={store}
              svgRef={svgRef}
              today={today}
              describedBy={hintId}
              onPlace={place}
              onChange={change}
              onDelete={remove}
            />
          </div>
          <p id={hintId} className="text-muted-foreground text-xs" aria-live="polite">
            {placing
              ? `${placing.plant.name} als ${kind === 'ROW' ? 'Reihe' : 'Einzelpflanze'} bei ${String(placing.at.x)} × ${String(placing.at.y)} cm: Pfeiltasten verschieben (mit Umschalt 25 cm), Enter oder Klick setzt, Escape bricht ab.`
              : selected
                ? `${selected.plant.name} ausgewählt: ziehen oder Pfeiltasten verschieben, Entf löscht, Escape hebt die Auswahl auf.`
                : 'Zoomen mit dem Mausrad oder zwei Fingern, verschieben durch Ziehen. Pflanzung anklicken zum Bearbeiten.'}
          </p>
        </div>
      </div>
      <DragOverlay dropAnimation={null}>
        {dragged && !preview ? (
          <div className="bg-card flex items-center gap-2 rounded-md border px-2 py-1 text-sm shadow-md">
            <PlantIcon plant={dragged} size={28} decorative />
            {dragged.name}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
