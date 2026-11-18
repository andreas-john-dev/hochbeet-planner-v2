import {
  type Bed,
  DEFAULT_GARDEN_VIEW,
  type Plant,
  type Planting,
  type Suggestion,
  type SowingWithPlantings,
} from '@hochbeet/contracts';
import { type Finding, isActiveInWeek, soilRenewalsIn } from '@hochbeet/garden-rules';
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
import { Link, useParams, useSearch } from '@tanstack/react-router';
import { parseISO } from 'date-fns';
import {
  ArrowLeft,
  Ellipsis,
  Maximize,
  MapPinOff,
  MessageCircle,
  Minus,
  Plus,
  Redo2,
  Settings2,
  Undo2,
  X,
} from 'lucide-react';
import { useEffect, useEffectEvent, useId, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { BedFormDialog } from '@/components/beds/BedFormDialog';
import { AssistantChat } from '@/components/editor/AssistantChat';
import { BedCanvas } from '@/components/editor/BedCanvas';
import { FindingsList } from '@/components/editor/FindingsList';
import { PlantingDetails } from '@/components/editor/PlantingDetails';
import { PlantOutDialog, type PlantOutRequest } from '@/components/editor/PlantOutDialog';
import { PlantPalette, type PaletteDragData } from '@/components/editor/PlantPalette';
import { SuggestionList } from '@/components/editor/SuggestionList';
import { WeekSlider } from '@/components/editor/WeekSlider';
import { EmptyState } from '@/components/EmptyState';
import { FormMessage } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { ViewOptions, ViewSwitch } from '@/components/ViewChoice';
import { ApiError, apiErrorMessage } from '@/lib/api';
import { activePlantings } from '@/lib/active-plantings';
import { canUseAssistant } from '@/lib/assistant';
import { useAuth } from '@/lib/auth/context';
import type { Change, Entry, Step } from '@/lib/editor/history';
import {
  bedCentre,
  isTempId,
  newPlanting,
  snapToBed,
  sowingPlantings,
  type PlantingKind,
} from '@/lib/editor/placement';
import { withDraft } from '@/lib/editor/plantings';
import { simplePlanting, simpleRemoval } from '@/lib/editor/simple';
import { createEditorStore, type EditorStore, type PreviewSowing } from '@/lib/editor/store';
import { parseBedEditorSearch } from '@/lib/editor/search';
import { adoptedPlanting, type ShownSuggestion, showSuggestions } from '@/lib/editor/suggestions';
import { seasonFindings, statusByPlanting, weekOfFinding } from '@/lib/editor/warnings';
import { useLanguage } from '@/lib/i18n';
import { ghosts, withPlants, type Ghost } from '@/lib/editor/timeline';
import { toCm } from '@/lib/editor/viewport';
import { DESKTOP_QUERY, useMediaQuery } from '@/lib/media-query';
import {
  useBedWithPlantings,
  useDeletePlanting,
  useGardenSettings,
  usePlants,
  useSavePlanting,
  useSowings,
} from '@/lib/garden';
import type { Language } from '@/lib/language';
import { plantName } from '@/lib/plant-names';
import { availableSowings } from '@/lib/sowings';
import { useView } from '@/lib/view';

const ZOOM_STEP = 1.4;

/** Route component for /beete/$bedId; remounts per bed so the editor state starts fresh. */
export function BedEditorPage() {
  const bedId = bedIdParam(useParams({ strict: false }));
  const { woche } = parseBedEditorSearch(useSearch({ strict: false }));
  return <BedEditor key={bedId} bedId={bedId} week={woche} />;
}

// Params are untyped here: typing them via the route would make router.tsx circular.
function bedIdParam(params: unknown): string {
  const value = (params as { bedId?: unknown } | null)?.bedId;
  return typeof value === 'string' ? value : '';
}

/** Bed editor: the bed true to scale with grid, plantings of the current week, zoom and pan. */
function BedEditor({ bedId, week: initialWeek }: { bedId: string; week?: string | undefined }) {
  const { t } = useTranslation(['editor', 'common']);
  const details = useBedWithPlantings(bedId);
  const plants = usePlants();
  const sowings = useSowings();
  // The user's last frost for the frost hint; guests and a pending load use 15 May.
  const lastFrost = useGardenSettings().data?.lastFrost;
  const [today] = useState(() => new Date());
  // Opened from a task of the week: on that week, else on today's.
  const [store] = useState(() => createEditorStore(initialWeek ? parseISO(initialWeek) : today));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { user, guest } = useAuth();
  // The view (Epic #161): undefined while the settings load; without settings the default.
  const viewState = useView();
  const view = viewState.view ?? (viewState.loadError ? DEFAULT_GARDEN_VIEW : undefined);
  const simple = view === 'SIMPLE';
  const viewSwitchId = useId();
  const assistant = canUseAssistant(user, guest);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const assistantId = useId();
  const viewHeadingId = useId();
  const save = useSavePlanting(bedId);
  const remove = useDeletePlanting(bedId);
  const { history, week } = useStore(store);
  const weekDate = parseISO(week);
  // The simple view always shows the current week, also when opened on another one.
  useEffect(() => {
    if (simple) store.getState().setWeek(today);
  }, [simple, store, today]);
  const queryClient = useQueryClient();
  // The assistant's suggestions, shown in the bed until taken over or discarded; never saved.
  const [suggested, setSuggested] = useState<{
    items: { index: number; suggestion: Suggestion }[];
    warnings: string[];
  } | null>(null);
  const suggestionBed = details.data?.bed;
  const suggestions = useMemo(
    () =>
      suggested && suggestionBed && plants.data
        ? showSuggestions(
            suggested.items,
            suggestionBed,
            details.data?.plantings ?? [],
            plants.data,
            week,
            lastFrost,
            simple ? 'SIMPLE' : 'ALL',
          )
        : [],
    [suggested, suggestionBed, details.data?.plantings, plants.data, week, lastFrost, simple],
  );
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

  /**
   * A change made by the user, or several from one action (e.g. plants from a sowing batch):
   * saved right away and undone together.
   */
  const commit = (changes: Change | Entry) => {
    const list: Entry = Array.isArray(changes) ? changes : [changes as Change];
    // A planting that is still being created cannot be changed yet.
    if (list.length === 0 || list.some((c) => c.before && isTempId(c.before.id))) return;
    store.getState().record(list);
    // Errors are shown below the editor; the optimistic update rolls itself back.
    Promise.all(list.map((c) => apply({ target: c.after, current: c.before }))).catch(
      () => undefined,
    );
  };

  const receiveSuggestions = (list: Suggestion[], warnings: string[]) => {
    setSuggested({ items: list.map((suggestion, index) => ({ index, suggestion })), warnings });
  };
  const dropSuggestions = (indexes: readonly number[]) => {
    setSuggested((current) => {
      const items = current?.items.filter((i) => !indexes.includes(i.index)) ?? [];
      return current && items.length > 0 ? { ...current, items } : null;
    });
  };
  // Taking over is an ordinary new planting: saved like one placed by hand, undoable.
  const adopt = (items: readonly ShownSuggestion[]) => {
    for (const item of items) commit({ before: null, after: adoptedPlanting(item) });
    dropSuggestions(items.map((i) => i.index));
  };
  const suggestionList = suggested && (
    <SuggestionList
      items={suggestions}
      warnings={suggested.warnings}
      onAdopt={(item) => {
        adopt([item]);
      }}
      onAdoptAll={() => {
        adopt(suggestions);
      }}
      onDiscard={() => {
        setSuggested(null);
      }}
    />
  );

  const travel = (direction: 'undo' | 'redo') => {
    queue.current = queue.current
      .then(settled)
      .then(async () => {
        const state = store.getState();
        const steps = direction === 'undo' ? state.undo() : state.redo();
        if (!steps) return;
        // One planting stays selected; after a group nothing is.
        state.select(steps.length === 1 ? (steps[0]?.target?.id ?? null) : null);
        await Promise.all(steps.map(apply));
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
      {t('back')}
    </Link>
  );

  if (details.isError) {
    const notFound = details.error instanceof ApiError && details.error.status === 404;
    return (
      <div className="flex flex-col gap-6">
        {backLink}
        {notFound ? (
          <EmptyState icon={MapPinOff} title={t('notFound.title')}>
            {t('notFound.text')}
          </EmptyState>
        ) : (
          <FormMessage tone="error">{t('loadError')}</FormMessage>
        )}
      </div>
    );
  }

  const bed = details.data?.bed;
  const shown = activePlantings(details.data?.plantings ?? [], plants.data ?? [], weekDate);
  const faint = simple
    ? []
    : ghosts(withPlants(details.data?.plantings ?? [], plants.data ?? []), week);

  /** "Mehr Möglichkeiten": to the view switch in the header, on phones in the menu. */
  const showViewSwitch = () => {
    if (!isDesktop) {
      setMoreOpen(true);
      return;
    }
    const target = document
      .getElementById(viewSwitchId)
      ?.querySelector<HTMLButtonElement>('button[aria-pressed="false"]');
    target?.focus();
  };

  return (
    <div className="flex flex-col gap-4">
      {backLink}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="truncate text-2xl font-semibold tracking-tight md:text-3xl">
            {bed?.name ?? t('bed')}
          </h1>
          <p className="text-muted-foreground text-sm">
            {bed && t('size', { width: bed.widthCm, depth: bed.depthCm })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex gap-2" role="toolbar" aria-label={t('toolbar.edit')}>
            <Button
              variant="outline"
              size="icon"
              aria-label={t('toolbar.bedSettings')}
              title={t('toolbar.bedSettingsTitle')}
              disabled={!bed}
              onClick={() => {
                setSettingsOpen(true);
              }}
            >
              <Settings2 />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label={t('toolbar.undo')}
              title={t('toolbar.undoTitle')}
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
              aria-label={t('toolbar.redo')}
              title={t('toolbar.redoTitle')}
              aria-keyshortcuts="Control+Shift+Z"
              disabled={history.future.length === 0}
              onClick={() => {
                travel('redo');
              }}
            >
              <Redo2 />
            </Button>
          </div>
          <div className="flex gap-2" role="toolbar" aria-label={t('toolbar.zoom')}>
            <Button
              variant="outline"
              size="icon"
              aria-label={t('toolbar.zoomOut')}
              onClick={() => {
                store.getState().zoomBy(1 / ZOOM_STEP);
              }}
            >
              <Minus />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label={t('toolbar.zoomIn')}
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
              {t('toolbar.fit')}
            </Button>
          </div>
          {assistant && (
            <Button
              variant={assistantOpen ? 'secondary' : 'outline'}
              className="h-11"
              aria-expanded={assistantOpen}
              aria-controls={isDesktop ? assistantId : undefined}
              onClick={() => {
                setAssistantOpen((open) => !open);
              }}
            >
              <MessageCircle aria-hidden />
              {t('toolbar.assistant')}
            </Button>
          )}
          {/* The view (T-73): in the header on larger screens, in the menu on phones. */}
          {isDesktop ? (
            <ViewSwitch id={viewSwitchId} />
          ) : (
            <Button
              variant="outline"
              size="icon"
              aria-label={t('toolbar.more')}
              aria-haspopup="dialog"
              onClick={() => {
                setMoreOpen(true);
              }}
            >
              <Ellipsis />
            </Button>
          )}
        </div>
      </div>
      {view === 'EXPERT' && (
        <WeekSlider
          week={week}
          today={today}
          renewals={bed ? soilRenewalsIn(bed, Number(week.slice(0, 4))) : []}
          onChange={(next) => {
            store.getState().setWeek(next);
          }}
        />
      )}
      <div className="flex flex-col gap-4 md:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {bed && plants.data && view ? (
            <Workspace
              simple={simple}
              bed={bed}
              plants={plants.data}
              plantings={shown}
              allPlantings={details.data?.plantings ?? []}
              ghosts={faint}
              suggestions={suggestions}
              store={store}
              week={weekDate}
              lastFrost={lastFrost}
              sowings={sowings.data ?? []}
              onCommit={commit}
            />
          ) : (
            <div
              className="bg-muted h-[60dvh] min-h-72 animate-pulse rounded-xl border md:h-[65dvh]"
              aria-busy="true"
            >
              <span className="sr-only">{t('loading')}</span>
            </div>
          )}
        </div>
        {assistant && isDesktop && bed && (
          // Stays mounted while hidden, so closing the panel keeps the conversation.
          <aside
            id={assistantId}
            hidden={!assistantOpen}
            aria-labelledby={`${assistantId}-title`}
            className="bg-card w-80 shrink-0 flex-col gap-2 rounded-xl border p-3 md:h-[65dvh] [&:not([hidden])]:flex"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 id={`${assistantId}-title`} className="font-semibold">
                {t('assistant.title')}
              </h2>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t('assistant.close')}
                onClick={() => {
                  setAssistantOpen(false);
                }}
              >
                <X />
              </Button>
            </div>
            <AssistantChat
              bedId={bed.id}
              active={assistantOpen}
              onSuggestions={receiveSuggestions}
              suggestions={suggestionList}
              className="flex-1"
            />
          </aside>
        )}
      </div>
      {simple && (
        <button
          type="button"
          onClick={showViewSwitch}
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 w-fit rounded-sm text-sm underline underline-offset-4 outline-none focus-visible:ring-[3px]"
        >
          {t('expertHint')}
        </button>
      )}
      {error && <FormMessage tone="error">{apiErrorMessage(error)}</FormMessage>}
      {bed && <BedFormDialog bed={bed} open={settingsOpen} onOpenChange={setSettingsOpen} />}
      <Sheet open={!isDesktop && moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent aria-describedby={undefined}>
          <SheetTitle>{t('toolbar.more')}</SheetTitle>
          <section aria-labelledby={viewHeadingId} className="flex flex-col gap-2">
            <h3 id={viewHeadingId} className="text-sm font-medium">
              {t('common:view.label')}
            </h3>
            <ViewOptions labelledBy={viewHeadingId} />
          </section>
        </SheetContent>
      </Sheet>
      {assistant && bed && (
        <Sheet open={!isDesktop && assistantOpen} onOpenChange={setAssistantOpen}>
          <SheetContent aria-describedby={undefined} className="h-[85dvh]">
            <SheetTitle>{t('assistant.title')}</SheetTitle>
            <AssistantChat
              bedId={bed.id}
              onSuggestions={receiveSuggestions}
              suggestions={suggestionList}
              className="flex-1"
            />
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}

type EditorT = TFunction<'editor'>;

/** What screen readers hear while a plant is dragged from the palette. */
function announcements(t: EditorT, language: Language): Announcements {
  const plant = (data: unknown) => {
    const dragged = (data as PaletteDragData | undefined)?.plant;
    return dragged ? plantName(dragged, language) : t('placement.plant');
  };
  return {
    onDragStart: ({ active }) => t('placement.pickedUp', { plant: plant(active.data.current) }),
    onDragOver: ({ active, over }) =>
      over ? t('placement.overBed', { plant: plant(active.data.current) }) : undefined,
    onDragEnd: ({ active }) => t('placement.dropped', { plant: plant(active.data.current) }),
    onDragCancel: ({ active }) =>
      t('placement.dragCancelled', { plant: plant(active.data.current) }),
  };
}

/** The line under the bed: what the user can do right now, read out by screen readers. */
function hint(
  t: EditorT,
  {
    placing,
    kind,
    selected,
    isDesktop,
    language,
  }: {
    placing: { plant: Plant; at: { x: number; y: number } } | null;
    kind: Planting['kind'];
    selected: string | undefined;
    isDesktop: boolean;
    language: Language;
  },
) {
  if (placing) {
    const what = t('placement.what', {
      plant: plantName(placing.plant, language),
      kind: t(kind === 'ROW' ? 'placement.asRow' : 'placement.asSingle'),
      x: placing.at.x,
      y: placing.at.y,
    });
    return isDesktop ? t('placement.keyboardHint', { what }) : t('placement.touchHint', { what });
  }
  if (selected && isDesktop) return t('placement.selectedHint', { plant: selected });
  return isDesktop ? t('placement.desktopHint') : t('placement.touchIdleHint');
}

/** Client coordinates where a pointer drag currently is. */
function dragPoint(event: DragMoveEvent) {
  const start = event.activatorEvent;
  if (!(start instanceof PointerEvent || start instanceof MouseEvent)) return null;
  return { x: start.clientX + event.delta.x, y: start.clientY + event.delta.y };
}

/** Palette and canvas with drag & drop and keyboard placement in between. */
function Workspace({
  simple,
  bed,
  plants,
  plantings,
  allPlantings,
  ghosts,
  suggestions,
  store,
  week,
  lastFrost,
  sowings,
  onCommit,
}: {
  /**
   * Simple view: the current week only, new plantings without an own end, removing ends older
   * plantings this week, only the spatial rules, no batches.
   */
  simple: boolean;
  bed: Bed;
  plants: readonly Plant[];
  /** Plantings in the bed in the shown week. */
  plantings: readonly { planting: Planting; plant: Plant }[];
  /** All plantings of the bed over time, for the rules. */
  allPlantings: readonly Planting[];
  ghosts: readonly Ghost[];
  /** The assistant's suggestions, drawn on top of the bed. */
  suggestions: readonly ShownSuggestion[];
  store: EditorStore;
  /** The week the editor shows; new plantings start on its Monday. */
  week: Date;
  /** The user's last frost (`MM-DD`), undefined for the default. */
  lastFrost: string | undefined;
  /** All sowing batches with their plantings from all beds. */
  sowings: readonly SowingWithPlantings[];
  onCommit: (changes: Change | Entry) => void;
}) {
  const { t } = useTranslation(['editor', 'common']);
  const svgRef = useRef<SVGSVGElement>(null);
  const hintId = useId();
  const [dragged, setDragged] = useState<PaletteDragData | null>(null);
  // Seedlings dropped from a sowing batch, waiting for „Wie viele?“.
  const [plantOut, setPlantOut] = useState<PlantOutRequest | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { language } = useLanguage();
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
      const planting = newPlanting({
        bed,
        plant: preview.plant,
        kind,
        at: preview.at,
        today: week,
        id: 'preview',
      });
      live.push(simple ? simplePlanting(planting, preview.plant, week) : planting);
    }
    const season = seasonFindings(bed, live, plants, weekIso, {
      language,
      lastFrost,
      sowings,
      scope: simple ? 'SIMPLE' : 'ALL',
    });
    const thisWeek = season.filter((f) => isActiveInWeek(f.period, weekIso));
    return { seasonal: season, statuses: statusByPlanting(thisWeek) };
  }, [
    simple,
    allPlantings,
    draft,
    preview,
    bed,
    kind,
    week,
    plants,
    weekIso,
    lastFrost,
    sowings,
    language,
  ]);

  // The simple view has no raising: no batches in the palette.
  const offered = useMemo(
    () => (simple ? [] : availableSowings(sowings, plants, weekIso)),
    [simple, sowings, plants, weekIso],
  );

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
    const sowing = state.preview?.sowing;
    state.setPreview(null);
    if (sowing) {
      setPlantOut({ plant, sowing, at });
      return;
    }
    const placed = newPlanting({ bed, plant, kind: state.kind, at, today: week });
    const planting = simple ? simplePlanting(placed, plant, week) : placed;
    // Rows get selected for their length handle; after a single plant the palette stays.
    state.select(planting.kind === 'ROW' ? planting.id : null);
    onCommit({ before: null, after: planting });
  };

  /** Plants `count` seedlings of the asked batch: one undo step for all of them. */
  const plantOutFromSowing = (kind: PlantingKind, count: number) => {
    if (!plantOut) return;
    const created = sowingPlantings({
      bed,
      plant: plantOut.plant,
      sowing: plantOut.sowing,
      kind,
      count,
      at: plantOut.at,
      week,
    });
    setPlantOut(null);
    const [only] = created;
    store.getState().select(created.length === 1 && only ? only.id : null);
    onCommit(created.map((after) => ({ before: null, after })));
  };

  const change = (before: Planting, after: Planting) => {
    onCommit({ before, after });
  };

  // In the simple view an older planting only leaves the bed this week (history stays).
  const remove = (planting: Planting) => {
    store.getState().select(null);
    onCommit(simple ? simpleRemoval(planting, week) : { before: planting, after: null });
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
    setDragged((event.active.data.current as PaletteDragData | undefined) ?? null);
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
      state.setPreview({
        plant: dragged.plant,
        at,
        source: 'drag',
        ...(dragged.sowing ? { sowing: dragged.sowing } : {}),
      });
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

  const choose = (plant: Plant, sowing?: PreviewSowing) => {
    const state = store.getState();
    const at = state.preview?.at ?? bedCentre(bed);
    state.select(null);
    state.setPreview({ plant, at, source: 'cursor', ...(sowing ? { sowing } : {}) });
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
        announcements: announcements(t, language),
        screenReaderInstructions: { draggable: t('placement.dragInstructions') },
      }}
    >
      <div className="flex flex-col gap-4 md:h-[65dvh] md:flex-row">
        {isDesktop &&
          (selected ? (
            <PlantingDetails
              // Fresh form state for another planting.
              key={selected.planting.id}
              planting={selected.planting}
              plant={selected.plant}
              week={week}
              sowings={sowings}
              simple={simple}
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
              sowings={offered}
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
              suggestions={suggestions}
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
                aria-label={t('placement.group')}
                className="bg-card flex flex-col gap-2 rounded-xl border p-3"
              >
                <div className="flex gap-2">
                  <Button variant="outline" className="h-11 flex-1" onClick={cancelPlacing}>
                    {t('common:cancel')}
                  </Button>
                  <Button
                    className="h-11 flex-1"
                    onClick={() => {
                      place(placing.plant, placing.at);
                    }}
                  >
                    {t('placement.plantHere')}
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
                {t('placement.addPlant')}
              </Button>
            ))}
          <p id={hintId} className="text-muted-foreground text-xs" aria-live="polite">
            {hint(t, {
              placing,
              kind,
              selected: selected && plantName(selected.plant, language),
              isDesktop,
              language,
            })}
          </p>
        </div>
      </div>
      <FindingsList
        findings={seasonal}
        week={weekIso}
        highlighted={highlighted}
        showPeriods={!simple}
        onPick={pick}
      />
      <Sheet open={!isDesktop && paletteOpen} onOpenChange={setPaletteOpen}>
        <SheetContent aria-describedby={undefined}>
          <SheetTitle>{t('placement.addPlant')}</SheetTitle>
          <PlantPalette
            plants={plants}
            sowings={offered}
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
              <SheetTitle className="sr-only">
                {t('details.label', { plant: plantName(selected.plant, language) })}
              </SheetTitle>
              <PlantingDetails
                key={selected.planting.id}
                planting={selected.planting}
                plant={selected.plant}
                week={week}
                sowings={sowings}
                simple={simple}
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
      <PlantOutDialog
        request={plantOut}
        defaultKind={kind}
        sheet={!isDesktop}
        onConfirm={plantOutFromSowing}
        onCancel={() => {
          setPlantOut(null);
        }}
      />
      <DragOverlay dropAnimation={null}>
        {dragged && !preview ? (
          <div className="bg-card flex items-center gap-2 rounded-md border px-2 py-1 text-sm shadow-md">
            <PlantIcon plant={dragged.plant} size={28} decorative />
            {plantName(dragged.plant, language)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
