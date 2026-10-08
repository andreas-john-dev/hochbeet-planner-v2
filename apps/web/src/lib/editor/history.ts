import type { Planting } from '@hochbeet/contracts';

/**
 * One undoable change of a planting: `before` null = created, `after` null = deleted,
 * both set = changed (moved, resized, dates).
 */
export interface Change {
  before: Planting | null;
  after: Planting | null;
}

/** What has to be sent to make `current` look like `target` again. */
export interface Step {
  target: Planting | null;
  current: Planting | null;
}

export interface History {
  past: readonly Change[];
  future: readonly Change[];
}

/** Undo steps kept per open bed. */
export const HISTORY_LIMIT = 100;

export const emptyHistory: History = { past: [], future: [] };

/** Adds a change made by the user; a new change discards what could be redone. */
export function record(history: History, change: Change): History {
  return { past: [...history.past, change].slice(-HISTORY_LIMIT), future: [] };
}

/** Takes back the last change: returns the new history and the step to apply. */
export function undo(history: History): { history: History; step: Step } | null {
  const change = history.past.at(-1);
  if (!change) return null;
  return {
    history: { past: history.past.slice(0, -1), future: [...history.future, change] },
    step: { target: change.before, current: change.after },
  };
}

/** Repeats the last undone change. */
export function redo(history: History): { history: History; step: Step } | null {
  const change = history.future.at(-1);
  if (!change) return null;
  return {
    history: { past: [...history.past, change], future: history.future.slice(0, -1) },
    step: { target: change.after, current: change.before },
  };
}

/**
 * Replaces a planting id everywhere in the history. Needed because the server assigns a
 * new id whenever a planting is created, also when undo brings back a deleted one.
 */
export function remapId(history: History, from: string, to: string): History {
  const swap = (p: Planting | null) => (p?.id === from ? { ...p, id: to } : p);
  const map = (changes: readonly Change[]) =>
    changes.map((c) => ({ before: swap(c.before), after: swap(c.after) }));
  return { past: map(history.past), future: map(history.future) };
}
