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

/** One undo step: the changes of one user action, e.g. all plantings from one sowing batch. */
export type Entry = readonly Change[];

export interface History {
  past: readonly Entry[];
  future: readonly Entry[];
}

/** Undo steps kept per open bed. */
export const HISTORY_LIMIT = 100;

export const emptyHistory: History = { past: [], future: [] };

/**
 * Adds what the user did, one change or several that undo together; a new entry discards
 * what could be redone.
 */
export function record(history: History, changes: Change | Entry): History {
  const entry = Array.isArray(changes) ? changes : [changes as Change];
  return { past: [...history.past, entry].slice(-HISTORY_LIMIT), future: [] };
}

/** Takes back the last entry: returns the new history and the steps to apply. */
export function undo(history: History): { history: History; steps: Step[] } | null {
  const entry = history.past.at(-1);
  if (!entry) return null;
  return {
    history: { past: history.past.slice(0, -1), future: [...history.future, entry] },
    steps: entry.map((c) => ({ target: c.before, current: c.after })).reverse(),
  };
}

/** Repeats the last undone entry. */
export function redo(history: History): { history: History; steps: Step[] } | null {
  const entry = history.future.at(-1);
  if (!entry) return null;
  return {
    history: { past: [...history.past, entry], future: history.future.slice(0, -1) },
    steps: entry.map((c) => ({ target: c.after, current: c.before })),
  };
}

/**
 * Replaces a planting id everywhere in the history. Needed because the server assigns a
 * new id whenever a planting is created, also when undo brings back a deleted one.
 */
export function remapId(history: History, from: string, to: string): History {
  const swap = (p: Planting | null) => (p?.id === from ? { ...p, id: to } : p);
  const map = (entries: readonly Entry[]) =>
    entries.map((entry) => entry.map((c) => ({ before: swap(c.before), after: swap(c.after) })));
  return { past: map(history.past), future: map(history.future) };
}
