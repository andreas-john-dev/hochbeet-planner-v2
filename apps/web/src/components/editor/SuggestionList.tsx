import type { Severity } from '@hochbeet/garden-rules';
import { Check, CheckCheck, X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { MarkdownInline } from '@/components/Markdown';
import { Button } from '@/components/ui/button';
import type { ShownSuggestion } from '@/lib/editor/suggestions';
import { cn } from '@/lib/utils';

const STATUS_CLASS: Record<Severity, string> = {
  WARNING: 'text-red-700 dark:text-red-400',
  HINT: 'text-muted-foreground',
  POSITIVE: 'text-green-700 dark:text-green-400',
};

/**
 * The assistant's suggestions shown in the bed: plant, place, reason and status, each to take
 * over; all at once or discard them. Taking over never happens on its own, and warnings never
 * block it.
 */
export function SuggestionList({
  items,
  warnings,
  onAdopt,
  onAdoptAll,
  onDiscard,
}: {
  items: readonly ShownSuggestion[];
  warnings: readonly string[];
  onAdopt: (item: ShownSuggestion) => void;
  onAdoptAll: () => void;
  onDiscard: () => void;
}) {
  const { t } = useTranslation('editor');
  const headingId = useId();
  const section = useRef<HTMLElement>(null);
  // New suggestions come in below the conversation: bring them into view.
  useEffect(() => {
    section.current?.scrollIntoView({ block: 'nearest' });
  }, []);
  return (
    <section
      aria-labelledby={headingId}
      ref={section}
      // Keeps its height; the chat around it scrolls when the panel is too short.
      className="bg-muted/40 flex shrink-0 flex-col gap-2 rounded-lg border p-2"
    >
      <h3 id={headingId} className="text-sm font-semibold">
        {t('suggestions.title')}
      </h3>
      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t('suggestions.none')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.index}
              data-testid={`suggestion-item-${String(item.index)}`}
              className="bg-card flex flex-col gap-1 rounded-md border p-2 text-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">
                    {item.planting.kind === 'ROW'
                      ? t('suggestions.rowName', {
                          plant: item.plant.name,
                          length: item.planting.lengthCm,
                        })
                      : item.plant.name}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {t('suggestions.at', { x: item.planting.x, y: item.planting.y })}
                    {item.status && (
                      <span className={cn('ml-2 font-medium', STATUS_CLASS[item.status])}>
                        {t(`severity.${item.status}`)}
                      </span>
                    )}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-11 shrink-0"
                  aria-label={t('suggestions.adoptPlant', { plant: item.plant.name })}
                  onClick={() => {
                    onAdopt(item);
                  }}
                >
                  <Check aria-hidden />
                  {t('suggestions.adopt')}
                </Button>
              </div>
              <p>
                <MarkdownInline text={item.suggestion.reason} />
              </p>
            </li>
          ))}
        </ul>
      )}
      {warnings.length > 0 && (
        <p className="text-xs text-red-700 dark:text-red-400">
          {t('suggestions.rulesSay', { warnings: warnings.join(' ') })}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {items.length > 1 && (
          <Button size="sm" className="h-11" onClick={onAdoptAll}>
            <CheckCheck aria-hidden />
            {t('suggestions.adoptAll')}
          </Button>
        )}
        <Button size="sm" variant="ghost" className="h-11" onClick={onDiscard}>
          <X aria-hidden />
          {t('suggestions.discard')}
        </Button>
      </div>
    </section>
  );
}
