import type { IsoDate } from '@hochbeet/contracts';
import { formatWeek, weekStart } from '@hochbeet/garden-rules';
import { addWeeks, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { monthMarks, sliderWeeks } from '@/lib/editor/timeline';

/**
 * Chooses the week the bed shows: a slider over the weeks of the year with month names,
 * the week as text next to it, and buttons for the previous and next week and today.
 */
export function WeekSlider({
  week,
  today,
  onChange,
}: {
  week: IsoDate;
  today: Date;
  onChange: (week: IsoDate) => void;
}) {
  const sliderId = useId();
  const weeks = sliderWeeks(week);
  const index = Math.max(0, weeks.indexOf(week));
  const { label } = formatWeek(week);
  const isCurrent = week === weekStart(today);
  const step = (by: number) => {
    onChange(weekStart(addWeeks(parseISO(week), by)));
  };

  return (
    <div className="flex flex-col gap-2" role="group" aria-label="Woche">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label="Vorherige Woche"
          onClick={() => {
            step(-1);
          }}
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Nächste Woche"
          onClick={() => {
            step(1);
          }}
        >
          <ChevronRight />
        </Button>
        <Button
          variant="outline"
          className="h-11"
          disabled={isCurrent}
          onClick={() => {
            onChange(weekStart(today));
          }}
        >
          Heute
        </Button>
        <p className="text-sm font-medium" aria-live="polite" data-testid="week-label">
          {label}
        </p>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={sliderId} className="sr-only">
          Woche wählen
        </label>
        <input
          id={sliderId}
          type="range"
          min={0}
          max={weeks.length - 1}
          step={1}
          value={index}
          aria-valuetext={label}
          onChange={(event) => {
            const next = weeks[Number(event.target.value)];
            if (next) onChange(next);
          }}
          className="accent-primary h-11 w-full cursor-pointer"
        />
        <div aria-hidden className="text-muted-foreground relative h-4 text-[11px]">
          {monthMarks(weeks).map((mark) => (
            <span
              key={mark.label}
              className="absolute -translate-x-1/2"
              // The thumb is about 16 px wide; keep the labels under its centre.
              style={{ left: `calc(${String(mark.at * 100)}% + ${String(8 - mark.at * 16)}px)` }}
            >
              {/* Phones only have room for the initial. */}
              <span className="md:hidden">{mark.label.charAt(0)}</span>
              <span className="hidden md:inline">{mark.label}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
