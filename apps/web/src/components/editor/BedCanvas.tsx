import type { Bed, Plant, Planting } from '@hochbeet/contracts';
import { useEffect, useRef } from 'react';
import { useStore } from 'zustand';
import type { EditorStore } from '@/lib/editor/store';
import { viewBox } from '@/lib/editor/viewport';
import { BedGrid } from './BedGrid';
import { PlantingShape } from './PlantingShape';

interface Pointer {
  x: number;
  y: number;
}

/**
 * The bed as SVG in cm. Mouse wheel zooms around the cursor, dragging the background pans;
 * on touch screens two fingers pinch-zoom and one finger swipes.
 */
export function BedCanvas({
  bed,
  plantings,
  store,
}: {
  bed: Bed;
  plantings: readonly { planting: Planting; plant: Plant }[];
  store: EditorStore;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const pointers = useRef(new Map<number, Pointer>());
  const { size, viewport, fitted } = useStore(store);

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
  }, [store, bed]);

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
  }, [store]);

  const local = (event: React.PointerEvent): Pointer => {
    const rect = svgRef.current?.getBoundingClientRect();
    return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) };
  };

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, local(event));
  };

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
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
  };

  return (
    <svg
      ref={svgRef}
      viewBox={
        size.width > 0
          ? viewBox(viewport, size)
          : `0 0 ${String(bed.widthCm)} ${String(bed.depthCm)}`
      }
      className="bg-card block h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
      role="group"
      aria-label={`Beet ${bed.name}, ${String(bed.widthCm)} × ${String(bed.depthCm)} cm`}
      data-testid="bed-canvas"
      data-scale={viewport.scale.toFixed(3)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      style={{ visibility: fitted ? 'visible' : 'hidden' }}
    >
      <BedGrid bed={bed} scale={viewport.scale} />
      <g data-testid="plantings">
        {plantings.map(({ planting, plant }) => (
          <PlantingShape key={planting.id} planting={planting} plant={plant} />
        ))}
      </g>
    </svg>
  );
}
