import { DEFAULT_LAST_FROST } from '@hochbeet/contracts';
import { RotateCcw } from 'lucide-react';
import { useId, useState } from 'react';
import { FormMessage } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { apiErrorMessage } from '@/lib/api';
import { useGardenSettings, useSaveGardenSettings } from '@/lib/garden';
import {
  daysInMonth,
  MONTH_NAMES,
  monthDay,
  monthDayText,
  toMonthDay,
} from '@/lib/garden-settings';

const selectClass =
  'bg-card focus-visible:ring-ring/50 h-11 rounded-md border px-3 text-base outline-none focus-visible:ring-[3px] md:h-9 md:text-sm';

/**
 * "Garten" in the profile: the last frost as day and month, valid every year. Frost
 * sensitive plants go outside only after it; without a saved day it is 15 May.
 */
export function GardenSettingsCard() {
  const settings = useGardenSettings();
  const save = useSaveGardenSettings();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Garten</CardTitle>
        <CardDescription>
          Dein letzter Frosttermin gilt jedes Jahr. Frostempfindliche Sorten kommen erst danach ins
          Freie, zum Beispiel im Aussaatkalender.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {settings.isPending ? (
          <Skeleton className="h-11 w-full max-w-sm rounded-md md:h-9" />
        ) : settings.isError ? (
          <FormMessage tone="error">{apiErrorMessage(settings.error)}</FormMessage>
        ) : (
          <LastFrostForm
            // Fresh form state when the saved value changes, e.g. after a reset.
            key={settings.data.lastFrost}
            saved={settings.data.lastFrost}
            saving={save.isPending}
            onSave={(lastFrost) => {
              save.mutate({ lastFrost });
            }}
          />
        )}
        {save.isError && <FormMessage tone="error">{apiErrorMessage(save.error)}</FormMessage>}
        {save.isSuccess && (
          <p role="status" className="text-muted-foreground text-sm">
            Gespeichert: letzter Frost am {monthDayText(save.data.lastFrost)}.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function LastFrostForm({
  saved,
  saving,
  onSave,
}: {
  saved: string;
  saving: boolean;
  onSave: (lastFrost: string) => void;
}) {
  const ids = { day: useId(), month: useId() };
  const [value, setValue] = useState(() => monthDay(saved));
  const current = toMonthDay(value.month, value.day);

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(current);
      }}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Letzter Frost</legend>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={ids.day}>Tag</Label>
            <select
              id={ids.day}
              className={selectClass}
              value={value.day}
              onChange={(event) => {
                setValue({ ...value, day: Number(event.target.value) });
              }}
            >
              {Array.from({ length: daysInMonth(value.month) }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}.
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={ids.month}>Monat</Label>
            <select
              id={ids.month}
              className={selectClass}
              value={value.month}
              onChange={(event) => {
                const month = Number(event.target.value);
                // Keep the day inside the month, e.g. 31 March → 30 April.
                setValue({ month, day: Math.min(value.day, daysInMonth(month)) });
              }}
            >
              {MONTH_NAMES.map((name, i) => (
                <option key={name} value={i + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" className="h-11 md:h-9" disabled={saving || current === saved}>
            Speichern
          </Button>
        </div>
      </fieldset>
      <div>
        <Button
          type="button"
          variant="outline"
          className="h-11 md:h-9"
          disabled={saving || saved === DEFAULT_LAST_FROST}
          onClick={() => {
            onSave(DEFAULT_LAST_FROST);
          }}
        >
          <RotateCcw aria-hidden />
          Auf {monthDayText(DEFAULT_LAST_FROST)} zurücksetzen
        </Button>
      </div>
    </form>
  );
}
