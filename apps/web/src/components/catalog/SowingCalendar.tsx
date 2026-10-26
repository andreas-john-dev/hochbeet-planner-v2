import type { CatalogPlant } from '@hochbeet/contracts';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { sowingFacts } from '@/lib/sowing';
import {
  CALENDAR_ROW_LABEL,
  type CalendarRowKind,
  frostText,
  monthTicks,
  segmentPosition,
  sowingCalendar,
} from '@/lib/sowing-calendar';
import { cn } from '@/lib/utils';

/** Bar colours with at least 3:1 against the band in light and dark mode. */
const ROW_COLOR: Record<CalendarRowKind, string> = {
  presow: 'bg-amber-600 dark:bg-amber-400',
  direct: 'bg-lime-700 dark:bg-lime-400',
  plantOut: 'bg-sky-700 dark:bg-sky-400',
  inBed: 'bg-green-800 dark:bg-green-500',
};

/**
 * "Aussaatkalender" of a plant like on the back of a seed packet: one band per step over the
 * year, each with the weeks in words next to it, then the durations and germination. Plants
 * without details get a hint; own plants a link to add them.
 */
export function SowingCalendar({ plant }: { plant: CatalogPlant }) {
  const [year] = useState(() => new Date().getFullYear());
  const calendar = sowingCalendar(plant, { year });
  const ticks = monthTicks(year);

  return (
    <section aria-labelledby="sowing-calendar" className="flex flex-col gap-2">
      <h2 id="sowing-calendar" className="text-lg font-semibold">
        Aussaatkalender
      </h2>
      {calendar && plant.sowing ? (
        <div className="bg-card flex flex-col gap-3 rounded-lg border p-3">
          <div aria-hidden className="text-muted-foreground relative h-4 text-xs">
            {ticks.map((tick) => (
              <span
                key={tick.label}
                className="absolute top-0"
                style={{ left: `${String(tick.left)}%` }}
              >
                <span className="sm:hidden">{tick.short}</span>
                <span className="hidden sm:inline">{tick.label}</span>
              </span>
            ))}
          </div>
          <ul className="flex flex-col gap-3" aria-label={`Aussaatkalender ${String(year)}`}>
            {calendar.rows.map((row) => (
              <li key={row.kind} data-row={row.kind} className="flex flex-col gap-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                  <span className="inline-flex items-center gap-2 font-medium">
                    <span
                      aria-hidden
                      className={cn('size-2.5 rounded-full', ROW_COLOR[row.kind])}
                    />
                    {CALENDAR_ROW_LABEL[row.kind]}
                    <span className="sr-only">:</span>
                  </span>
                  <span className="text-muted-foreground">{row.text}</span>
                </div>
                <div aria-hidden className="bg-muted relative h-3 overflow-hidden rounded-full">
                  {ticks.slice(1).map((tick) => (
                    <span
                      key={tick.label}
                      className="bg-border absolute inset-y-0 w-px"
                      style={{ left: `${String(tick.left)}%` }}
                    />
                  ))}
                  {row.segments.map((segment) => {
                    const { left, width } = segmentPosition(segment, calendar.weeks);
                    return (
                      <span
                        key={segment.from}
                        data-from={segment.from}
                        data-to={segment.to}
                        className={cn('absolute inset-y-0 rounded-full', ROW_COLOR[row.kind])}
                        style={{ left: `${String(left)}%`, width: `${String(width)}%` }}
                      />
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
          <ul className="text-muted-foreground flex flex-col gap-0.5 border-t pt-3 text-sm">
            {sowingFacts(plant.sowing).map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
            {plant.frostSensitive && <li>{frostText()}</li>}
          </ul>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          Für diese Sorte gibt es noch keine Angaben zu Aussaat und Anzucht.
          {plant.source === 'OWN' && (
            <>
              {' '}
              <Link
                to="/katalog/$plantId/bearbeiten"
                params={{ plantId: plant.id }}
                className="text-foreground font-medium underline underline-offset-4"
              >
                Angaben ergänzen
              </Link>
            </>
          )}
        </p>
      )}
    </section>
  );
}
