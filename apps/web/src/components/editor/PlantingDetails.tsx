import type { Plant, Planting } from '@hochbeet/contracts';
import { formatWeek } from '@hochbeet/garden-rules';
import { PlantIcon } from '@hochbeet/plant-icons/react';
import { CalendarX, Trash2, Undo2, X } from 'lucide-react';
import { useId, useState } from 'react';
import { FormMessage } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { checkEnd, formatDate, plantingEnd, removalDate } from '@/lib/editor/details';
import { plantPositions } from '@/lib/editor/plantings';
import { cn } from '@/lib/utils';

const END_HINT = {
  removed: 'manuell entfernt',
  manual: 'angepasst',
  lifecycle: 'aus der Standzeit',
  none: 'mehrjährig, ohne Ende',
} as const;

/**
 * Side panel for the selected planting: plant, position, real dates, a custom end,
 * "Entfernen ab" the chosen week and delete. Every change goes through `onChange`
 * so that it can be undone.
 */
export function PlantingDetails({
  planting,
  plant,
  week,
  onChange,
  onDelete,
  onClose,
  className,
}: {
  planting: Planting;
  plant: Plant;
  /** The week the editor shows; "Entfernen ab" uses its Monday. */
  week: Date;
  onChange: (before: Planting, after: Planting) => void;
  onDelete: (planting: Planting) => void;
  onClose: () => void;
  className?: string;
}) {
  const endId = useId();
  const { end, source, lifecycleEnd } = plantingEnd(planting, plant);
  const [endValue, setEndValue] = useState(planting.endDate ?? '');
  const [endError, setEndError] = useState<string | null>(null);
  const removal = removalDate(planting, week);
  const weekLabel = formatWeek(week).week;

  const description =
    planting.kind === 'ROW'
      ? `Reihe, ${String(planting.lengthCm)} cm mit ${String(plantPositions(planting, plant).length)} Pflanzen`
      : 'Einzelpflanze';

  const saveEnd = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = checkEnd(planting, endValue);
    if ('error' in result) {
      setEndError(result.error);
      return;
    }
    setEndError(null);
    if (result.endDate !== planting.endDate) {
      onChange(planting, { ...planting, endDate: result.endDate });
    }
  };

  return (
    <aside
      aria-label={`Pflanzung ${plant.name}`}
      className={cn(
        'bg-card flex min-h-0 flex-col gap-4 overflow-y-auto rounded-xl border p-3',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <PlantIcon plant={plant} size={40} decorative />
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="truncate font-semibold">{plant.name}</h2>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Auswahl aufheben" onClick={onClose}>
          <X />
        </Button>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Position</dt>
        <dd>
          {String(planting.x)} × {String(planting.y)} cm
        </dd>
        <dt className="text-muted-foreground">Gepflanzt</dt>
        <dd>{formatDate(planting.startDate)}</dd>
        <dt className="text-muted-foreground">Ende</dt>
        <dd>
          {end ? formatDate(end) : 'unbegrenzt'}
          <span className="text-muted-foreground block text-xs">{END_HINT[source]}</span>
        </dd>
      </dl>

      <form onSubmit={saveEnd} className="flex flex-col gap-2" noValidate>
        <label htmlFor={endId} className="text-sm font-medium">
          Ende anpassen
        </label>
        <div className="flex gap-2">
          <Input
            id={endId}
            type="date"
            value={endValue}
            min={planting.startDate}
            aria-invalid={endError !== null}
            onChange={(event) => {
              setEndValue(event.target.value);
            }}
          />
          <Button type="submit" variant="outline" className="h-11">
            Übernehmen
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          {lifecycleEnd
            ? `Leer lassen für das Ende aus der Standzeit (${formatDate(lifecycleEnd)}).`
            : 'Leer lassen für eine Dauerkultur ohne Ende.'}
        </p>
        {endError && <FormMessage tone="error">{endError}</FormMessage>}
      </form>

      <div className="flex flex-col gap-2">
        {planting.removedDate ? (
          <>
            <p className="text-sm">Entfernt ab {formatDate(planting.removedDate)}.</p>
            <Button
              variant="outline"
              onClick={() => {
                onChange(planting, { ...planting, removedDate: null });
              }}
            >
              <Undo2 aria-hidden />
              Wieder ins Beet nehmen
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              disabled={removal === null}
              onClick={() => {
                if (removal) onChange(planting, { ...planting, removedDate: removal });
              }}
            >
              <CalendarX aria-hidden />
              Entfernen ab {weekLabel}
            </Button>
            <p className="text-muted-foreground text-xs">
              {removal
                ? `Die Pflanzung bleibt in der Historie und zählt für die Fruchtfolge.`
                : `Die Pflanzung beginnt erst nach ${weekLabel}.`}
            </p>
          </>
        )}
        <Button
          variant="outline"
          className="text-red-700 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
          onClick={() => {
            onDelete(planting);
          }}
        >
          <Trash2 aria-hidden />
          Pflanzung löschen
        </Button>
      </div>
    </aside>
  );
}
