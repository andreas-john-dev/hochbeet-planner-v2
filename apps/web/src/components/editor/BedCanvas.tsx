import type { Bed, Plant, Planting } from '@hochbeet/contracts';
import { useEffect, useRef, type RefObject } from 'react';
import { useStore } from 'zustand';
import { isTempId, moveByKey, newPlanting, snapToBed } from '@/lib/editor/placement';
import type { Draft, EditorStore } from '@/lib/editor/store';
import { toCm, viewBox } from '@/lib/editor/viewport';
import { BedGrid } from './BedGrid';
import { PlantingShape } from './PlantingShape';
import { RowHandle } from './RowHandle';

interface Pointer {
  x: number;
  y: number;
}

/** A planting being dragged: where it was and where the pointer went down. */
interface Move {
  planting: Planting;
  from: Pointer;
}

/** Pointer travel in px up to which a press counts as a click, not a pan or move. */
const CLICK_TOLERANCE_PX = 5;

const withDraft = (planting: Planting, draft: Draft | null): Planting => {
  if (draft?.id !== planting.id) return planting;
  const moved = { ...planting, x: draft.x ?? planting.x, y: draft.y ?? planting.y };
  return moved.kind === 'ROW' ? { ...moved, lengthCm: draft.lengthCm ?? moved.lengthCm } : moved;
};

/** The planting id of an element inside a planting, if any. */
const plantingIdOf = (target: EventTarget) =>
  target instanceof Element
    ? (target.closest('[data-planting-id]')?.getAttribute('data-planting-id') ?? null)
    : null;

/**
 * The bed as SVG in cm. Mouse wheel zooms around the cursor, dragging the background pans;
 * on touch screens two fingers pinch-zoom and one finger swipes.
 *
 * Plantings are selected by click or focus and moved by dragging them with the mouse or
 * with the arrow keys; Delete removes them. While a plant from the palette is chosen
 * (`preview.source === 'cursor'`), the arrow keys move it and Enter or a click places it.
 */
export function BedCanvas({
  bed,
  plantings,
  store,
  svgRef,
  today,
  describedBy,
  onPlace,
  onChange,
  onDelete,
}: {
  bed: Bed;
  plantings: readonly { planting: Planting; plant: Plant }[];
  store: EditorStore;
  svgRef: RefObject<SVGSVGElement | null>;
  today: Date;
  /** Id of the element with the keyboard instructions. */
  describedBy?: string;
  onPlace: (plant: Plant, at: { x: number; y: number }) => void;
  onChange: (before: Planting, after: Planting) => void;
  onDelete: (planting: Planting) => void;
}) {
  const pointers = useRef(new Map<number, Pointer>());
  const pressedAt = useRef<Pointer | null>(null);
  // Planting under the pointer at press time; with pointer capture, later events target the SVG.
  const pressedId = useRef<string | null>(null);
  const move = useRef<Move | null>(null);
  const { size, viewport, fitted, preview, kind, selectedId, draft } = useStore(store);

  // Measure the drawing area and fit the bed once the size is known.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      store.getState().setSize({ width, height });
      if (!store.getState().fitted && width > 0) store.getState().fit(bed);
    });
    observer.observe(svg);
    return () => {
      observer.disconnect();
    };
  }, [store, bed, svgRef]);

  // Wheel zoom needs a non-passive listener to stop the page from scrolling.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = svg.getBoundingClientRect();
      store.getState().zoomAt(Math.exp(-event.deltaY * 0.0015), {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      svg.removeEventListener('wheel', onWheel);
    };
  }, [store, svgRef]);

  const local = (event: React.PointerEvent): Pointer => {
    const rect = svgRef.current?.getBoundingClientRect();
    return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) };
  };

  /** Grid point in the bed under a screen point. */
  const clientToBed = (clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    return toCm(store.getState().viewport, {
      x: clientX - (rect?.left ?? 0),
      y: clientY - (rect?.top ?? 0),
    });
  };

  const cursorPreview = preview?.source === 'cursor' ? preview : null;
  const plantingById = (id: string | null) =>
    id === null ? undefined : plantings.find(({ planting }) => planting.id === id);

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, local(event));
    pressedAt.current = pointers.current.size === 1 ? local(event) : null;
    pressedId.current = plantingIdOf(event.target);
    // Mouse and pen drag plantings; on touch screens one finger keeps panning (T-27).
    const target = plantingById(pressedId.current);
    move.current =
      target && !cursorPreview && event.pointerType !== 'touch' && pointers.current.size === 1
        ? { planting: target.planting, from: local(event) }
        : null;
  };

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) {
      // A chosen plant follows the mouse until it is placed.
      if (cursorPreview && event.pointerType === 'mouse') {
        const at = snapToBed(clientToBed(event.clientX, event.clientY), bed);
        if (at.x !== cursorPreview.at.x || at.y !== cursorPreview.at.y) {
          store.getState().setPreview({ ...cursorPreview, at });
        }
      }
      return;
    }
    const current = local(event);
    const state = store.getState();
    if (move.current) {
      const { planting, from } = move.current;
      if (!state.draft && Math.hypot(current.x - from.x, current.y - from.y) <= CLICK_TOLERANCE_PX)
        return;
      const at = snapToBed(
        {
          x: planting.x + (current.x - from.x) / state.viewport.scale,
          y: planting.y + (current.y - from.y) / state.viewport.scale,
        },
        bed,
      );
      if (state.selectedId !== planting.id) state.select(planting.id);
      if (state.draft?.x !== at.x || state.draft.y !== at.y) {
        state.setDraft({ id: planting.id, ...at });
      }
    } else if (pointers.current.size === 1) {
      state.pan(current.x - previous.x, current.y - previous.y);
    } else if (pointers.current.size === 2) {
      // Pinch: zoom by the change of the finger distance around their midpoint.
      const other = [...pointers.current.entries()].find(([id]) => id !== event.pointerId)?.[1];
      if (other) {
        const before = Math.hypot(previous.x - other.x, previous.y - other.y);
        const after = Math.hypot(current.x - other.x, current.y - other.y);
        const mid = { x: (current.x + other.x) / 2, y: (current.y + other.y) / 2 };
        if (before > 0) state.zoomAt(after / before, mid);
        state.pan((current.x - previous.x) / 2, (current.y - previous.y) / 2);
      }
    }
    pointers.current.set(event.pointerId, current);
  };

  const onPointerEnd = (event: React.PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(event.pointerId);
    const state = store.getState();
    const moved = move.current;
    move.current = null;
    if (moved && state.draft) {
      const after = withDraft(moved.planting, state.draft);
      state.setDraft(null);
      if (
        event.type === 'pointerup' &&
        (after.x !== moved.planting.x || after.y !== moved.planting.y)
      )
        onChange(moved.planting, after);
      pressedAt.current = null;
      return;
    }
    const start = pressedAt.current;
    pressedAt.current = null;
    if (event.type !== 'pointerup' || !start) return;
    const end = local(event);
    if (Math.hypot(end.x - start.x, end.y - start.y) > CLICK_TOLERANCE_PX) return;
    // A click: places the chosen plant, selects a planting or clears the selection.
    if (cursorPreview) {
      onPlace(cursorPreview.plant, snapToBed(clientToBed(event.clientX, event.clientY), bed));
    } else {
      state.select(pressedId.current);
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<SVGSVGElement>) => {
    const state = store.getState();
    if (event.key === 'Escape') {
      state.setPreview(null);
      state.select(null);
      if (plantingIdOf(event.target)) svgRef.current?.focus();
      return;
    }
    if (cursorPreview) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onPlace(cursorPreview.plant, cursorPreview.at);
        return;
      }
      const at = moveByKey(cursorPreview.at, event.key, event.shiftKey, bed);
      if (!at) return;
      event.preventDefault();
      state.setPreview({ ...cursorPreview, at });
      return;
    }
    // Keys on a focused planting: arrows move it, Delete removes it.
    const focused = plantingById(plantingIdOf(event.target));
    if (!focused) return;
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      onDelete(focused.planting);
      svgRef.current?.focus();
      return;
    }
    const at = moveByKey(focused.planting, event.key, event.shiftKey, bed);
    if (!at) return;
    event.preventDefault();
    if (at.x !== focused.planting.x || at.y !== focused.planting.y) {
      onChange(focused.planting, { ...focused.planting, ...at });
    }
  };

  const selected = plantingById(selectedId);
  const shown = plantings.map((entry) =>
    entry === selected ? { ...entry, planting: withDraft(entry.planting, draft) } : entry,
  );
  const shownSelected = shown.find(({ planting }) => planting.id === selectedId);
  const selectedRow = selected?.planting.kind === 'ROW' ? selected.planting : null;

  return (
    <svg
      ref={svgRef}
      viewBox={
        size.width > 0
          ? viewBox(viewport, size)
          : `0 0 ${String(bed.widthCm)} ${String(bed.depthCm)}`
      }
      className={`bg-card focus-visible:ring-ring block h-full w-full touch-none outline-none select-none focus-visible:ring-2 focus-visible:ring-inset ${cursorPreview ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
      role="group"
      tabIndex={0}
      aria-label={`Beet ${bed.name}, ${String(bed.widthCm)} × ${String(bed.depthCm)} cm`}
      aria-describedby={describedBy}
      data-testid="bed-canvas"
      data-scale={viewport.scale.toFixed(3)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onKeyDown={onKeyDown}
      style={{ visibility: fitted ? 'visible' : 'hidden' }}
    >
      <BedGrid bed={bed} scale={viewport.scale} />
      <g data-testid="plantings">
        {shown.map(({ planting, plant }) => (
          <PlantingShape
            key={planting.id}
            planting={planting}
            plant={plant}
            selected={planting.id === selectedId}
            onFocus={() => {
              if (store.getState().selectedId !== planting.id) store.getState().select(planting.id);
            }}
          />
        ))}
      </g>
      {selected &&
        selectedRow &&
        shownSelected?.planting.kind === 'ROW' &&
        !isTempId(selectedRow.id) && (
          <RowHandle
            row={shownSelected.planting}
            plant={selected.plant}
            bed={bed}
            scale={viewport.scale}
            toCm={clientToBed}
            onDraft={(lengthCm) => {
              store
                .getState()
                .setDraft(lengthCm === null ? null : { id: selectedRow.id, lengthCm });
            }}
            onCommit={(lengthCm) => {
              onChange(selectedRow, { ...selectedRow, lengthCm });
            }}
          />
        )}
      {preview && (
        <PlantingShape
          planting={newPlanting({
            bed,
            plant: preview.plant,
            kind,
            at: preview.at,
            today,
            id: 'preview',
          })}
          plant={preview.plant}
          variant="preview"
        />
      )}
    </svg>
  );
}
