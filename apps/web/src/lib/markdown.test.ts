import { describe, expect, it } from 'vitest';
import { parseInline, parseMarkdown } from './markdown';

const text = (value: string) => ({ type: 'text', text: value }) as const;

describe('parseInline', () => {
  it('reads bold, italic and code', () => {
    expect(parseInline('Tomaten mögen **Basilikum**, *nicht* `Fenchel`.')).toEqual([
      text('Tomaten mögen '),
      { type: 'strong', children: [text('Basilikum')] },
      text(', '),
      { type: 'em', children: [text('nicht')] },
      text(' '),
      { type: 'code', text: 'Fenchel' },
      text('.'),
    ]);
    expect(parseInline('__fett__ und _schräg_')).toEqual([
      { type: 'strong', children: [text('fett')] },
      text(' und '),
      { type: 'em', children: [text('schräg')] },
    ]);
  });

  it('nests italic in bold and keeps markers inside code', () => {
    expect(parseInline('**sehr *wichtig* hier**')).toEqual([
      {
        type: 'strong',
        children: [text('sehr '), { type: 'em', children: [text('wichtig')] }, text(' hier')],
      },
    ]);
    expect(parseInline('`**x**`')).toEqual([{ type: 'code', text: '**x**' }]);
  });

  it('leaves open or loose markers as they are', () => {
    // While the answer streams in, the closing stars may still be missing.
    expect(parseInline('Gut zu **Basil')).toEqual([text('Gut zu **Basil')]);
    expect(parseInline('3 * 4 = 12, 2 * 5')).toEqual([text('3 * 4 = 12, 2 * 5')]);
    expect(parseInline('** kein fett **')).toEqual([text('** kein fett **')]);
    expect(parseInline('plant_id und bed_id')).toEqual([text('plant_id und bed_id')]);
    expect(parseInline('<b>nie HTML</b>')).toEqual([text('<b>nie HTML</b>')]);
  });
});

describe('parseMarkdown', () => {
  it('splits paragraphs at blank lines and keeps line breaks within them', () => {
    expect(parseMarkdown('Erste Zeile\nzweite Zeile\n\nNeuer Absatz')).toEqual([
      { type: 'paragraph', lines: [[text('Erste Zeile')], [text('zweite Zeile')]] },
      { type: 'paragraph', lines: [[text('Neuer Absatz')]] },
    ]);
  });

  it('reads bullet and numbered lists, also right below a paragraph', () => {
    expect(
      parseMarkdown(
        'Gute Nachbarn:\n- **Basilikum**\n* Möhre\n  mit Abstand\n\n1. Säen\n2) Pikieren',
      ),
    ).toEqual([
      { type: 'paragraph', lines: [[text('Gute Nachbarn:')]] },
      {
        type: 'list',
        ordered: false,
        start: 1,
        items: [
          [{ type: 'strong', children: [text('Basilikum')] }],
          [text('Möhre'), text(' '), text('mit Abstand')],
        ],
      },
      { type: 'list', ordered: true, start: 1, items: [[text('Säen')], [text('Pikieren')]] },
    ]);
    expect(parseMarkdown('3. Auspflanzen')).toEqual([
      { type: 'list', ordered: true, start: 3, items: [[text('Auspflanzen')]] },
    ]);
  });

  it('starts a new list when the kind changes', () => {
    expect(parseMarkdown('- a\n1. b').map((b) => b.type === 'list' && b.ordered)).toEqual([
      false,
      true,
    ]);
  });

  it('reads headings and drops horizontal rules', () => {
    expect(parseMarkdown('## Anzucht ##\nText\n\n---\n\nMehr')).toEqual([
      { type: 'heading', content: [text('Anzucht')] },
      { type: 'paragraph', lines: [[text('Text')]] },
      { type: 'paragraph', lines: [[text('Mehr')]] },
    ]);
  });

  it('keeps tables and other syntax as text', () => {
    expect(parseMarkdown('| Sorte | Abstand |\r\n|---|---|')).toEqual([
      { type: 'paragraph', lines: [[text('| Sorte | Abstand |')], [text('|---|---|')]] },
    ]);
    expect(parseMarkdown('')).toEqual([]);
  });
});
