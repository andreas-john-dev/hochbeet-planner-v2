import { Fragment, useMemo } from 'react';
import { type Inline, parseInline, parseMarkdown } from '@/lib/markdown';
import { cn } from '@/lib/utils';

function Inlines({ content }: { content: readonly Inline[] }) {
  return content.map((part, index) => {
    switch (part.type) {
      case 'text':
        return <Fragment key={index}>{part.text}</Fragment>;
      case 'strong':
        return (
          <strong key={index} className="font-semibold">
            <Inlines content={part.children} />
          </strong>
        );
      case 'em':
        return (
          <em key={index}>
            <Inlines content={part.children} />
          </em>
        );
      case 'code':
        return (
          <code key={index} className="bg-background/70 rounded px-1 font-mono text-[0.9em]">
            {part.text}
          </code>
        );
    }
  });
}

/**
 * Text with the simple Markdown of the Beet-Assistent (`parseMarkdown()`), as React elements:
 * no HTML from the text ever reaches the page. Headings show as bold lines, so the answer
 * does not add to the page's heading outline.
 */
export function Markdown({ text, className }: { text: string; className?: string }) {
  const blocks = useMemo(() => parseMarkdown(text), [text]);
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'heading':
            return (
              <p key={index} className="font-semibold">
                <Inlines content={block.content} />
              </p>
            );
          case 'paragraph':
            return (
              <p key={index}>
                {block.lines.map((line, n) => (
                  <Fragment key={n}>
                    {n > 0 && <br />}
                    <Inlines content={line} />
                  </Fragment>
                ))}
              </p>
            );
          case 'list': {
            const items = block.items.map((item, n) => (
              <li key={n}>
                <Inlines content={item} />
              </li>
            ));
            return block.ordered ? (
              <ol key={index} start={block.start} className="list-decimal space-y-1 pl-5">
                {items}
              </ol>
            ) : (
              <ul key={index} className="list-disc space-y-1 pl-5">
                {items}
              </ul>
            );
          }
        }
      })}
    </div>
  );
}

/** One line with bold, italic and code, e.g. the reason of a suggestion. */
export function MarkdownInline({ text }: { text: string }) {
  const content = useMemo(() => parseInline(text), [text]);
  return <Inlines content={content} />;
}
