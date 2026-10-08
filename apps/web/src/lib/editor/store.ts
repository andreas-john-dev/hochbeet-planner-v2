import type { Plant } from '@hochbeet/contracts';
import { createStore } from 'zustand/vanilla';
import type { PlantingKind } from './placement';
import { fitToBed, panBy, type Point, type Size, type Viewport, zoomAt } from './viewport';

export interface EditorState {
  /** Size of the drawing area in px; zero until it was measured. */
  size: Size;
  viewport: Viewport;
  /** False until the editor was fitted to the bed once. */
  fitted: boolean;
  setSize: (size: Size) => void;
  fit: (bed: { widthCm: number; depthCm: number }) => void;
  zoomAt: (factor: number, at: Point) => void;
  /** Zooms around the centre of the drawing area, e.g. for the + and − buttons. */
  zoomBy: (factor: number) => void;
  pan: (dxPx: number, dyPx: number) => void;

  /** Single plant or row, chosen in the palette. */
  kind: PlantingKind;
  setKind: (kind: PlantingKind) => void;
  /**
   * Planting about to be placed, at a grid point in cm: while dragging from the palette
   * (`drag`) or after choosing a plant for keyboard or click placement (`cursor`).
   */
  preview: Preview | null;
  setPreview: (preview: Preview | null) => void;
  /** The planting with the row handle, e.g. the one just placed. */
  selectedId: string | null;
  select: (id: string | null) => void;
  /** Row length while its handle is being dragged, before it is saved. */
  draftLength: number | null;
  setDraftLength: (lengthCm: number | null) => void;
}

export interface Preview {
  plant: Plant;
  at: Point;
  source: 'drag' | 'cursor';
}

/** Editor state of one open bed: view, placement and selection. Plantings come from TanStack Query. */
export function createEditorStore() {
  return createStore<EditorState>()((set, get) => ({
    size: { width: 0, height: 0 },
    viewport: { x: 0, y: 0, scale: 1 },
    fitted: false,
    setSize: (size) => {
      set({ size });
    },
    fit: (bed) => {
      set({ viewport: fitToBed(bed, get().size), fitted: true });
    },
    zoomAt: (factor, at) => {
      set({ viewport: zoomAt(get().viewport, factor, at) });
    },
    zoomBy: (factor) => {
      const { size, viewport } = get();
      set({ viewport: zoomAt(viewport, factor, { x: size.width / 2, y: size.height / 2 }) });
    },
    pan: (dxPx, dyPx) => {
      set({ viewport: panBy(get().viewport, dxPx, dyPx) });
    },
    kind: 'SINGLE',
    setKind: (kind) => {
      set({ kind });
    },
    preview: null,
    setPreview: (preview) => {
      set({ preview });
    },
    selectedId: null,
    select: (selectedId) => {
      set({ selectedId, draftLength: null });
    },
    draftLength: null,
    setDraftLength: (draftLength) => {
      set({ draftLength });
    },
  }));
}

export type EditorStore = ReturnType<typeof createEditorStore>;
