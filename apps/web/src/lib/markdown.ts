/**
 * The small part of Markdown the Beet-Assistent writes: paragraphs, lists, headings, bold,
 * italic and inline code. Parsed into plain data and rendered as React elements by
 * `Markdown`, so text from the model never becomes HTML. Anything else (tables, links,
 * markers left open while the answer streams in) stays as written.
 */

export type Inline =
  | { type: 'text'; text: string }
  | { type: 'strong'; children: Inline[] }
  | { type: 'em'; children: Inline[] }
  | { type: 'code'; text: string };

export type Block =
  /** Lines of a paragraph, shown with line breaks between them. */
  | { type: 'paragraph'; lines: Inline[][] }
  | { type: 'heading'; content: Inline[] }
  | { type: 'list'; ordered: boolean; start: number; items: Inline[][] };

// Code first, so markers inside it stay literal; bold before italic. Markers must hug their
// text (`** x**` is no bold), and `_` only counts outside words (`plant_id`).
const INLINE =
  /`([^`\n]+)`|\*\*(?=\S)(.+?)(?<=\S)\*\*|(?<![\p{L}\p{N}_])__(?=\S)(.+?)(?<=\S)__(?![\p{L}\p{N}_])|\*(?=[^\s*])([^*\n]+?)(?<=[^\s*])\*|(?<![\p{L}\p{N}_])_(?=[^\s_])([^_\n]+?)(?<=[^\s_])_(?![\p{L}\p{N}_])/gu;

/** Bold, italic and code within one line or list item. */
export function parseInline(text: string): Inline[] {
  const result: Inline[] = [];
  const pushText = (value: string) => {
    if (!value) return;
    const last = result.at(-1);
    if (last?.type === 'text') last.text += value;
    else result.push({ type: 'text', text: value });
  };
  let at = 0;
  for (const match of text.matchAll(INLINE)) {
    pushText(text.slice(at, match.index));
    const [, code, bold, boldUnderscore, em, emUnderscore] = match;
    if (code !== undefined) result.push({ type: 'code', text: code });
    else if (bold !== undefined || boldUnderscore !== undefined) {
      result.push({ type: 'strong', children: parseInline(bold ?? boldUnderscore ?? '') });
    } else {
      result.push({ type: 'em', children: parseInline(em ?? emUnderscore ?? '') });
    }
    at = match.index + match[0].length;
  }
  pushText(text.slice(at));
  return result;
}

const HEADING = /^ {0,3}#{1,6}\s+(.*?)\s*#*\s*$/;
const BULLET = /^\s*[-*+]\s+(.*)$/;
const NUMBERED = /^\s*(\d{1,9})[.)]\s+(.*)$/;
const RULE = /^ {0,3}([-*_])(\s*\1){2,}\s*$/;

/** Blocks of an answer; also of a partial answer while it streams in. */
export function parseMarkdown(text: string): Block[] {
  const blocks: Block[] = [];
  let current: Block | undefined;
  const close = () => {
    if (current) blocks.push(current);
    current = undefined;
  };

  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (!line.trim() || RULE.test(line)) {
      close();
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      close();
      blocks.push({ type: 'heading', content: parseInline(heading[1] ?? '') });
      continue;
    }
    const numbered = NUMBERED.exec(line);
    const bullet = numbered ? null : BULLET.exec(line);
    if (numbered || bullet) {
      const ordered = numbered !== null;
      const item = parseInline((numbered ? numbered[2] : bullet?.[1]) ?? '');
      if (current?.type !== 'list' || current.ordered !== ordered) {
        close();
        current = { type: 'list', ordered, start: numbered ? Number(numbered[1]) : 1, items: [] };
      }
      current.items.push(item);
      continue;
    }
    // A line right below a list item continues it, as in Markdown.
    if (current?.type === 'list') {
      const last = current.items.at(-1);
      if (last) {
        last.push({ type: 'text', text: ' ' }, ...parseInline(line.trim()));
        continue;
      }
    }
    if (current?.type !== 'paragraph') {
      close();
      current = { type: 'paragraph', lines: [] };
    }
    current.lines.push(parseInline(line.trim()));
  }
  close();
  return blocks;
}
