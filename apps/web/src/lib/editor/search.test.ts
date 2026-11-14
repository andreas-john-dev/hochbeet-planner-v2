import { describe, expect, it } from 'vitest';
import { parseBedEditorSearch } from './search';

describe('bed editor search', () => {
  it('takes the Monday of a valid date and drops anything else', () => {
    expect(parseBedEditorSearch({ woche: '2027-05-24' })).toEqual({ woche: '2027-05-24' });
    expect(parseBedEditorSearch({ woche: '2027-05-27' })).toEqual({ woche: '2027-05-24' });
    expect(parseBedEditorSearch({ woche: '2027-02-30' })).toEqual({ woche: undefined });
    expect(parseBedEditorSearch({ woche: 20270524 })).toEqual({ woche: undefined });
    expect(parseBedEditorSearch(undefined)).toEqual({ woche: undefined });
  });
});
