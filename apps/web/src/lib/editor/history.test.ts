import type { Planting } from '@hochbeet/contracts';
import { describe, expect, it } from 'vitest';
import { emptyHistory, HISTORY_LIMIT, record, redo, remapId, undo } from './history';

const planting = (id: string, x: number): Planting => ({
  id,
  bedId: '01J9ZQ3W8D6V2K5M7N8P9R0S1A',
  plantId: '01M49THV00QS1SEJEM64991JH5',
  kind: 'SINGLE',
  x,
  y: 50,
  startDate: '2026-10-05',
  endDate: null,
  removedDate: null,
});

describe('undo history', () => {
  it('undoes and redoes a move', () => {
    const before = planting('a', 40);
    const after = planting('a', 60);
    const h1 = record(emptyHistory, { before, after });

    const undone = undo(h1);
    expect(undone?.step).toEqual({ target: before, current: after });
    expect(undone?.history).toEqual({ past: [], future: [{ before, after }] });

    const redone = undone && redo(undone.history);
    expect(redone?.step).toEqual({ target: after, current: before });
    expect(redone?.history).toEqual(h1);
  });

  it('turns undoing a creation into a delete and undoing a delete into a creation', () => {
    const created = planting('a', 40);
    expect(undo(record(emptyHistory, { before: null, after: created }))?.step).toEqual({
      target: null,
      current: created,
    });
    expect(undo(record(emptyHistory, { before: created, after: null }))?.step).toEqual({
      target: created,
      current: null,
    });
  });

  it('has nothing to undo or redo when empty', () => {
    expect(undo(emptyHistory)).toBeNull();
    expect(redo(emptyHistory)).toBeNull();
  });

  it('drops the redo stack on a new change', () => {
    const h = record(emptyHistory, { before: planting('a', 0), after: planting('a', 5) });
    const undone = undo(h);
    if (!undone) throw new Error('nothing undone');
    const next = record(undone.history, { before: planting('b', 0), after: null });
    expect(next.future).toEqual([]);
    expect(next.past).toHaveLength(1);
  });

  it(`keeps the last ${String(HISTORY_LIMIT)} changes`, () => {
    let h = emptyHistory;
    for (let i = 0; i <= HISTORY_LIMIT; i++)
      h = record(h, { before: null, after: planting('a', i) });
    expect(h.past).toHaveLength(HISTORY_LIMIT);
    expect(h.past[0]?.after?.x).toBe(1);
  });

  it('remaps a temporary or recreated id in all entries', () => {
    let h = record(emptyHistory, { before: null, after: planting('tmp-1', 40) });
    h = record(h, { before: planting('tmp-1', 40), after: planting('tmp-1', 60) });
    h = remapId(h, 'tmp-1', 'real');
    expect(h.past.flatMap((c) => [c.before?.id, c.after?.id])).toEqual([
      undefined,
      'real',
      'real',
      'real',
    ]);
  });
});
