import type { IsoDate } from '@hochbeet/contracts';
import { type Finding, isActiveInWeek, type Severity } from '@hochbeet/garden-rules';
import { CircleCheck, Info, TriangleAlert, type LucideIcon } from 'lucide-react';
import { useId } from 'react';
import { findingsSummary, formatPeriod } from '@/lib/editor/warnings';
import { cn } from '@/lib/utils';

const STYLE: Record<Severity, { icon: LucideIcon; className: string; label: string }> = {
  WARNING: { icon: TriangleAlert, className: 'text-red-600 dark:text-red-400', label: 'Warnung' },
  HINT: { icon: Info, className: 'text-muted-foreground', label: 'Hinweis' },
  POSITIVE: {
    icon: CircleCheck,
    className: 'text-green-700 dark:text-green-400',
    label: 'Gute Nachbarn',
  },
};

const keyOf = (f: Finding) => `${f.rule}:${f.plantingIds.join(',')}:${f.period.start}`;

/**
 * Findings of the season with German text and period. A click highlights the plantings
 * and jumps to the week; findings outside the shown week are greyed out.
 */
export function FindingsList({
  findings,
  week,
  highlighted,
  onPick,
}: {
  findings: readonly Finding[];
  week: IsoDate;
  highlighted: readonly string[];
  onPick: (finding: Finding) => void;
}) {
  const headingId = useId();
  const isPicked = (f: Finding) =>
    highlighted.length > 0 && f.plantingIds.join(',') === highlighted.join(',');

  return (
    <section aria-labelledby={headingId} className="flex min-h-0 flex-col gap-1">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h2 id={headingId} className="text-sm font-semibold">
          Hinweise dieser Saison
        </h2>
        <p className="text-muted-foreground text-xs" data-testid="findings-summary">
          {findingsSummary(findings)}
        </p>
      </div>
      {findings.length > 0 && (
        <ul className="-mx-1 max-h-40 overflow-y-auto px-1" aria-label="Hinweise">
          {findings.map((finding) => {
            const { icon: Icon, className, label } = STYLE[finding.severity];
            const now = isActiveInWeek(finding.period, week);
            return (
              <li key={keyOf(finding)}>
                <button
                  type="button"
                  aria-pressed={isPicked(finding)}
                  data-severity={finding.severity.toLowerCase()}
                  onClick={() => {
                    onPick(finding);
                  }}
                  className={cn(
                    'hover:bg-accent focus-visible:ring-ring/50 flex min-h-11 w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none focus-visible:ring-[3px]',
                    isPicked(finding) && 'bg-accent',
                    !now && 'opacity-60',
                  )}
                >
                  <Icon aria-hidden className={cn('mt-0.5 size-4 shrink-0', className)} />
                  <span className="sr-only">{label}: </span>
                  <span className="flex-1">{finding.message}</span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {formatPeriod(finding.period)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
