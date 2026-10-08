import type { Bed, Plant, Planting } from '@hochbeet/contracts';
import { type Finding, isActiveInWeek } from '@hochbeet/garden-rules';
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
import { useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { parseISO } from 'date-fns';
import { ArrowLeft, Maximize, MapPinOff, Minus, Plus, Redo2, Undo2 } from 'lucide-react';
import { useEffect, useEffectEvent, useId, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { BedCanvas } from '@/components/editor/BedCanvas';
import { FindingsList } from '@/components/editor/FindingsList';
import { PlantingDetails } from '@/components/editor/PlantingDetails';
import { PlantPalette, type PaletteDragData } from '@/components/editor/PlantPalette';
import { WeekSlider } from '@/components/editor/WeekSlider';
import { EmptyState } from '@/components/EmptyState';
import { FormMessage } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { ApiError, apiErrorMessage } from '@/lib/api';
import { activePlantings } from '@/lib/active-plantings';
import type { Change, Step } from '@/lib/editor/history';
import { bedCentre, isTempId, newPlanting, snapToBed } from '@/lib/editor/placement';
import { withDraft } from '@/lib/editor/plantings';
import { createEditorStore, type EditorStore } from '@/lib/editor/store';
import { seasonFindings, statusByPlanting, weekOfFinding } from '@/lib/editor/warnings';
import { ghosts, withPlants, type Ghost } from '@/lib/editor/timeline';
import { toCm } from '@/lib/editor/viewport';
import { DESKTOP_QUERY, useMediaQuery } from '@/lib/media-query';
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
  const [today] = useState(() => new Date());
  const [store] = useState(() => createEditorStore(today));
  const save = useSavePlanting(bedId);
  const remove = useDeletePlanting(bedId);
  const { history, week } = useStore(store);
  const weekDate = parseISO(week);
  const queryClient = useQueryClient();
  // Undo and redo run one after another, each after all running requests have finished,
  // so that temporary ids are resolved first and no key press gets lost.
  const queue = useRef<Promise<void>>(Promise.resolve());
  const error = save.error ?? remove.error;

  /** Resolves once no request is running any more. */
  const settled = () =>
    new Promise<void>((resolve) => {
      if (queryClient.isMutating() === 0) {
        resolve();
        return;
      }
      const unsubscribe = queryClient.getMutationCache().subscribe(() => {
        if (queryClient.isMutating() > 0) return;
        unsubscribe();
        resolve();
      });
    });

  /** Sends what turns `current` into `target`: create, change or delete. */
  const apply = async ({ target, current }: Step) => {
    if (target && current) {
      await save.mutateAsync({ planting: target, isNew: false });
    } else if (target) {
      const created = await save.mutateAsync({ planting: target, isNew: true });
      // The server assigns the real id; the history and the selection follow it.
      store.getState().remapId(target.id, created.id);
    } else if (current) {
      await remove.mutateAsync(current.id);
    }
  };

  /** A change made by the user: saved right away and undoable. */
  const commit = (change: Change) => {
    // A planting that is still being created cannot be changed yet.
    if (change.before && isTempId(change.before.id)) return;
    store.getState().record(change);
    // Errors are shown below the editor; the optimistic update rolls itself back.
    apply({ target: change.after, current: change.before }).catch(() => undefined);
  };

  const travel = (direction: 'undo' | 'redo') => {
    queue.current = queue.current
      .then(settled)
      .then(async () => {
        const state = store.getState();
        const step = direction === 'undo' ? state.undo() : state.redo();
        if (!step) return;
        state.select(step.target?.id ?? null);
        await apply(step);
      })
      .catch(() => undefined);
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
  const shown = activePlantings(details.data?.plantings ?? [], plants.data ?? [], weekDate);
  const faint = ghosts(withPlants(details.data?.plantings ?? [], plants.data ?? []), week);

  return (
    <div className="flex flex-col gap-4">
      {backLink}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="truncate text-2xl font-semibold tracking-tight md:text-3xl">
            {bed?.name ?? 'Beet'}
          </h1>
          <p className="text-muted-foreground text-sm">
            {bed && `${String(bed.widthCm)} × ${String(bed.depthCm)} cm`}
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
              disabled={history.past.length === 0}
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
              disabled={history.future.length === 0}
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
      <WeekSlider
        week={week}
        today={today}
        onChange={(next) => {
          store.getState().setWeek(next);
        }}
      />
      {bed && plants.data ? (
        <Workspace
          bed={bed}
          plants={plants.data}
          plantings={shown}
          allPlantings={details.data?.plantings ?? []}
          ghosts={faint}
          store={store}
          week={weekDate}
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

/** The line under the bed: what the user can do right now, read out by screen readers. */
function hint({
  placing,
  kind,
  selected,
  isDesktop,
}: {
  placing: { plant: Plant; at: { x: number; y: number } } | null;
  kind: Planting['kind'];
  selected: string | undefined;
  isDesktop: boolean;
}) {
  if (placing) {
    const what = `${placing.plant.name} als ${kind === 'ROW' ? 'Reihe' : 'Einzelpflanze'} bei ${String(placing.at.x)} × ${String(placing.at.y)} cm`;
    return isDesktop
      ? `${what}: Pfeiltasten verschieben (mit Umschalt 25 cm), Enter oder Klick setzt, Escape bricht ab.`
      : `${what}: Auf die gewünschte Stelle im Beet tippen, dann „Hier pflanzen“.`;
  }
  if (selected && isDesktop) {
    return `${selected} ausgewählt: ziehen oder Pfeiltasten verschieben, Entf löscht, Escape hebt die Auswahl auf.`;
  }
  return isDesktop
    ? 'Zoomen mit dem Mausrad oder zwei Fingern, verschieben durch Ziehen. Pflanzung anklicken zum Bearbeiten.'
    : 'Mit zwei Fingern zoomen, mit einem verschieben. Pflanzung antippen zum Bearbeiten, lange drücken zum Verschieben.';
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
  allPlantings,
  ghosts,
  store,
  week,
  onCommit,
}: {
  bed: Bed;
  plants: readonly Plant[];
  /** Plantings in the bed in the shown week. */
  plantings: readonly { planting: Planting; plant: Plant }[];
  /** All plantings of the bed over time, for the rules. */
  allPlantings: readonly Planting[];
  ghosts: readonly Ghost[];
  store: EditorStore;
  /** The week the editor shows; new plantings start on its Monday. */
  week: Date;
  onCommit: (change: Change) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const hintId = useId();
  const [dragged, setDragged] = useState<Plant | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const {
    preview,
    kind,
    selectedId,
    inspecting,
    draft,
    highlighted,
    week: weekIso,
  } = useStore(store);

  // The rules run on every change, including a planting being dragged or about to be placed,
  // so that warnings show up before the user lets go. They never block saving.
  const { seasonal, statuses } = useMemo(() => {
    const live = allPlantings.map((p) => withDraft(p, draft));
    if (preview) {
      live.push(
        newPlanting({
          bed,
          plant: preview.plant,
          kind,
          at: preview.at,
          today: week,
          id: 'preview',
        }),
      );
    }
    const season = seasonFindings(bed, live, plants, weekIso);
    const thisWeek = season.filter((f) => isActiveInWeek(f.period, weekIso));
    return { seasonal: season, statuses: statusByPlanting(thisWeek) };
  }, [allPlantings, draft, preview, bed, kind, week, plants, weekIso]);

  const pick = (finding: Finding) => {
    const state = store.getState();
    const same = finding.plantingIds.join(',') === state.highlighted.join(',');
    state.setHighlighted(same ? [] : finding.plantingIds);
    state.setWeek(weekOfFinding(finding, state.week));
  };
  // Sidebars on wide screens, bottom sheets on phones.
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  // A short move starts a drag; a plain click on a palette item picks the plant.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const place = (plant: Plant, at: { x: number; y: number }) => {
    const state = store.getState();
    const planting = newPlanting({ bed, plant, kind: state.kind, at, today: week });
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
    state.select(null);
    state.setPreview({ plant, at, source: 'cursor' });
    // Keyboard users continue in the bed; on phones the sheet closes for tap-to-place.
    if (isDesktop) svgRef.current?.focus();
    else setPaletteOpen(false);
  };

  const cancelPlacing = () => {
    store.getState().setPreview(null);
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
        {isDesktop &&
          (selected ? (
            <PlantingDetails
              // Fresh form state for another planting or after undo.
              key={`${selected.planting.id}-${selected.planting.endDate ?? ''}`}
              planting={selected.planting}
              plant={selected.plant}
              week={week}
              onChange={change}
              onDelete={remove}
              onClose={() => {
                store.getState().select(null);
              }}
              className="w-72 shrink-0"
            />
          ) : (
            <PlantPalette
              plants={plants}
              store={store}
              onChoose={choose}
              className="w-72 shrink-0"
            />
          ))}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="bg-card h-[60dvh] min-h-72 overflow-hidden rounded-xl border md:h-auto md:flex-1">
            <BedCanvas
              bed={bed}
              plantings={plantings}
              store={store}
              svgRef={svgRef}
              today={week}
              ghosts={ghosts}
              statuses={statuses}
              describedBy={hintId}
              onPlace={place}
              onChange={change}
              onDelete={remove}
            />
          </div>
          {!isDesktop &&
            (placing ? (
              <div
                role="group"
                aria-label="Pflanze setzen"
                className="bg-card flex flex-col gap-2 rounded-xl border p-3"
              >
                <div className="flex gap-2">
                  <Button variant="outline" className="h-11 flex-1" onClick={cancelPlacing}>
                    Abbrechen
                  </Button>
                  <Button
                    className="h-11 flex-1"
                    onClick={() => {
                      place(placing.plant, placing.at);
                    }}
                  >
                    Hier pflanzen
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                className="h-11"
                onClick={() => {
                  setPaletteOpen(true);
                }}
              >
                <Plus aria-hidden />
                Pflanze hinzufügen
              </Button>
            ))}
          <p id={hintId} className="text-muted-foreground text-xs" aria-live="polite">
            {hint({ placing, kind, selected: selected?.plant.name, isDesktop })}
          </p>
        </div>
      </div>
      <FindingsList findings={seasonal} week={weekIso} highlighted={highlighted} onPick={pick} />
      <Sheet open={!isDesktop && paletteOpen} onOpenChange={setPaletteOpen}>
        <SheetContent aria-describedby={undefined}>
          <SheetTitle>Pflanze hinzufügen</SheetTitle>
          <PlantPalette
            plants={plants}
            store={store}
            onChoose={choose}
            variant="sheet"
            className="flex-1"
          />
        </SheetContent>
      </Sheet>
      <Sheet
        open={!isDesktop && selected !== undefined && inspecting}
        onOpenChange={(open) => {
          if (!open) store.getState().select(null);
        }}
      >
        <SheetContent showClose={false} aria-describedby={undefined}>
          {selected && (
            <>
              <SheetTitle className="sr-only">{`Pflanzung ${selected.plant.name}`}</SheetTitle>
              <PlantingDetails
                key={`${selected.planting.id}-${selected.planting.endDate ?? ''}`}
                planting={selected.planting}
                plant={selected.plant}
                week={week}
                onChange={change}
                onDelete={remove}
                onClose={() => {
                  store.getState().select(null);
                }}
                className="rounded-none border-0 bg-transparent p-0"
              />
            </>
          )}
        </SheetContent>
      </Sheet>
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
