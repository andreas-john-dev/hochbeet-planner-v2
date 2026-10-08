import type { Plant } from '@hochbeet/contracts';
import { createStore } from 'zustand/vanilla';
import {
  emptyHistory,
  record,
  redo,
  remapId,
  undo,
  type Change,
  type History,
  type Step,
} from './history';
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
  /** The planting shown in the detail panel and with the row handle. */
  selectedId: string | null;
  select: (id: string | null) => void;
  /**
   * True when the selection came from a tap or click, not from moving: on phones the detail
   * sheet only opens then, so that a long-press move does not cover the bed.
   */
  inspecting: boolean;
  inspect: (id: string) => void;
  /** Position or row length while a planting is dragged, before it is saved. */
  draft: Draft | null;
  setDraft: (draft: Draft | null) => void;

  /** Undo/redo of planting changes made in this editor. */
  history: History;
  record: (change: Change) => void;
  /** Moves the last change to the redo stack and returns what to send, or null. */
  undo: () => Step | null;
  redo: () => Step | null;
  /** The server gave a (re)created planting a new id. */
  remapId: (from: string, to: string) => void;
}

export interface Draft {
  id: string;
  x?: number;
  y?: number;
  lengthCm?: number;
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
      set({ selectedId, draft: null, inspecting: false });
    },
    inspecting: false,
    inspect: (selectedId) => {
      set({ selectedId, draft: null, inspecting: true });
    },
    draft: null,
    setDraft: (draft) => {
      set({ draft });
    },
    history: emptyHistory,
    record: (change) => {
      set({ history: record(get().history, change) });
    },
    undo: () => {
      const result = undo(get().history);
      if (!result) return null;
      set({ history: result.history });
      return result.step;
    },
    redo: () => {
      const result = redo(get().history);
      if (!result) return null;
      set({ history: result.history });
      return result.step;
    },
    remapId: (from, to) => {
      const { history, selectedId } = get();
      set({
        history: remapId(history, from, to),
        selectedId: selectedId === from ? to : selectedId,
      });
    },
  }));
}

export type EditorStore = ReturnType<typeof createEditorStore>;
