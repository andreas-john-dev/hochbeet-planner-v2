import type { Bed, Plant, Planting } from '@hochbeet/contracts';
import { useEffect, useRef, type RefObject } from 'react';
import { useStore } from 'zustand';
import { isTempId, moveByKey, newPlanting, snapToBed } from '@/lib/editor/placement';
import type { EditorStore } from '@/lib/editor/store';
import { toCm, viewBox } from '@/lib/editor/viewport';
import { BedGrid } from './BedGrid';
import { PlantingShape } from './PlantingShape';
import { RowHandle } from './RowHandle';

interface Pointer {
  x: number;
  y: number;
}

/** Pointer travel in px up to which a press counts as a click, not a pan. */
const CLICK_TOLERANCE_PX = 5;

/**
 * The bed as SVG in cm. Mouse wheel zooms around the cursor, dragging the background pans;
 * on touch screens two fingers pinch-zoom and one finger swipes.
 *
 * While a plant from the palette is chosen (`preview.source === 'cursor'`), the arrow keys
 * move it in 5 cm steps and Enter or a click places it; Escape cancels.
 */
export function BedCanvas({
  bed,
  plantings,
  store,
  svgRef,
  today,
  describedBy,
  onPlace,
  onResizeRow,
}: {
  bed: Bed;
  plantings: readonly { planting: Planting; plant: Plant }[];
  store: EditorStore;
  svgRef: RefObject<SVGSVGElement | null>;
  today: Date;
  /** Id of the element with the keyboard instructions. */
  describedBy?: string;
  onPlace: (plant: Plant, at: { x: number; y: number }) => void;
  onResizeRow: (planting: Planting, lengthCm: number) => void;
}) {
  const pointers = useRef(new Map<number, Pointer>());
  const pressedAt = useRef<Pointer | null>(null);
  const { size, viewport, fitted, preview, kind, selectedId, draftLength } = useStore(store);

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

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, local(event));
    pressedAt.current = pointers.current.size === 1 ? local(event) : null;
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
    if (pointers.current.size === 1) {
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
    const start = pressedAt.current;
    pressedAt.current = null;
    if (event.type !== 'pointerup' || !start) return;
    const end = local(event);
    if (Math.hypot(end.x - start.x, end.y - start.y) > CLICK_TOLERANCE_PX) return;
    // A click: places the chosen plant, otherwise clears the selection.
    if (cursorPreview) {
      onPlace(cursorPreview.plant, snapToBed(clientToBed(event.clientX, event.clientY), bed));
    } else {
      store.getState().select(null);
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<SVGSVGElement>) => {
    const state = store.getState();
    if (event.key === 'Escape') {
      state.setPreview(null);
      state.select(null);
      return;
    }
    if (!cursorPreview) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onPlace(cursorPreview.plant, cursorPreview.at);
      return;
    }
    const at = moveByKey(cursorPreview.at, event.key, event.shiftKey, bed);
    if (!at) return;
    event.preventDefault();
    state.setPreview({ ...cursorPreview, at });
  };

  const selected = plantings.find(({ planting }) => planting.id === selectedId);
  const shown = plantings.map((entry) =>
    entry === selected && entry.planting.kind === 'ROW' && draftLength !== null
      ? { ...entry, planting: { ...entry.planting, lengthCm: draftLength } }
      : entry,
  );
  const shownSelected = shown.find(({ planting }) => planting.id === selectedId);

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
          />
        ))}
      </g>
      {shownSelected?.planting.kind === 'ROW' && !isTempId(shownSelected.planting.id) && (
        <RowHandle
          row={shownSelected.planting}
          plant={shownSelected.plant}
          bed={bed}
          scale={viewport.scale}
          toCm={clientToBed}
          onDraft={(lengthCm) => {
            store.getState().setDraftLength(lengthCm);
          }}
          onCommit={(lengthCm) => {
            onResizeRow(shownSelected.planting, lengthCm);
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
