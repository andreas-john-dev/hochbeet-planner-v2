import { createStore } from 'zustand/vanilla';
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
}

/** Editor state of one open bed: zoom and pan. Plantings come from TanStack Query. */
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
  }));
}

export type EditorStore = ReturnType<typeof createEditorStore>;
