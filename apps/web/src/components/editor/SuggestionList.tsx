import type { Severity } from '@hochbeet/garden-rules';
import { Check, CheckCheck, X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import { Button } from '@/components/ui/button';
import type { ShownSuggestion } from '@/lib/editor/suggestions';
import { cn } from '@/lib/utils';

const STATUS: Record<Severity, { label: string; className: string }> = {
  WARNING: { label: 'Warnung', className: 'text-red-700 dark:text-red-400' },
  HINT: { label: 'Hinweis', className: 'text-muted-foreground' },
  POSITIVE: { label: 'Gute Nachbarn', className: 'text-green-700 dark:text-green-400' },
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
        Pflanzvorschläge im Beet
      </h3>
      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">Keine Vorschläge mehr offen.</p>
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
                    {item.plant.name}
                    {item.planting.kind === 'ROW' &&
                      ` (Reihe, ${String(item.planting.lengthCm)} cm)`}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    bei {item.planting.x} × {item.planting.y} cm
                    {item.status && (
                      <span className={cn('ml-2 font-medium', STATUS[item.status].className)}>
                        {STATUS[item.status].label}
                      </span>
                    )}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-11 shrink-0"
                  aria-label={`${item.plant.name} übernehmen`}
                  onClick={() => {
                    onAdopt(item);
                  }}
                >
                  <Check aria-hidden />
                  Übernehmen
                </Button>
              </div>
              <p>{item.suggestion.reason}</p>
            </li>
          ))}
        </ul>
      )}
      {warnings.length > 0 && (
        <p className="text-xs text-red-700 dark:text-red-400">
          Die Regel-Engine meldet noch: {warnings.join(' ')}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {items.length > 1 && (
          <Button size="sm" className="h-11" onClick={onAdoptAll}>
            <CheckCheck aria-hidden />
            Alle übernehmen
          </Button>
        )}
        <Button size="sm" variant="ghost" className="h-11" onClick={onDiscard}>
          <X aria-hidden />
          Verwerfen
        </Button>
      </div>
    </section>
  );
}
