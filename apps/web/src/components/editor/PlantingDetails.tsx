import type { Plant, Planting, PlantingOrigin, SowingWithPlantings } from '@hochbeet/contracts';
import { formatWeek } from '@hochbeet/garden-rules';
import { PlantIcon } from '@hochbeet/plant-icons/react';
import { Link } from '@tanstack/react-router';
import { CalendarX, Trash2, Undo2, X } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FormMessage } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  checkEnd,
  formatDate,
  plantingEnd,
  removalDate,
  withOrigin,
  withSowing,
} from '@/lib/editor/details';
import { plantPositions } from '@/lib/editor/plantings';
import { originText, weekText } from '@/lib/sowings';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n';
import { plantName } from '@/lib/plant-names';

const ORIGINS = [
  { origin: 'DIRECT_SOW', label: 'details.directSow' },
  { origin: 'TRANSPLANT', label: 'details.transplant' },
] as const satisfies readonly { origin: PlantingOrigin; label: string }[];

/**
 * Side panel for the selected planting: plant, position, direct sown or planted out, real
 * dates, a custom end, "Entfernen ab" the chosen week and delete. Every change goes through
 * `onChange` so that it can be undone.
 */
export function PlantingDetails({
  planting,
  plant,
  week,
  sowings = [],
  onChange,
  onDelete,
  onClose,
  className,
}: {
  planting: Planting;
  plant: Plant;
  /** The week the editor shows; "Entfernen ab" uses its Monday. */
  week: Date;
  /** All sowing batches, for where planted out seedlings come from. */
  sowings?: readonly SowingWithPlantings[];
  onChange: (before: Planting, after: Planting) => void;
  onDelete: (planting: Planting) => void;
  onClose: () => void;
  className?: string;
}) {
  const { t } = useTranslation('editor');
  const { language } = useLanguage();
  const date = (iso: string) => formatDate(iso, language);
  const ids = { end: useId(), origin: useId(), originHint: useId(), sowing: useId() };
  const { end, source, lifecycleEnd } = plantingEnd(planting, plant);
  const [endValue, setEndValue] = useState(planting.endDate ?? '');
  const [endError, setEndError] = useState<string | null>(null);
  // The end changes from outside too (switching the origin, undo): show the new one.
  const [shownEnd, setShownEnd] = useState(planting.endDate);
  if (shownEnd !== planting.endDate) {
    setShownEnd(planting.endDate);
    setEndValue(planting.endDate ?? '');
    setEndError(null);
  }
  const extraWeeks = plant.sowing?.directSowExtraWeeks ?? 0;
  const removal = removalDate(planting, week);
  const weekLabel = formatWeek(week, language).week;

  const description =
    planting.kind === 'ROW'
      ? t('details.row', {
          length: planting.lengthCm,
          count: plantPositions(planting, plant).length,
        })
      : t('details.single');

  const saveEnd = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = checkEnd(planting, endValue, language);
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
      aria-label={t('details.label', { plant: plantName(plant, language) })}
      className={cn(
        'bg-card flex min-h-0 flex-col gap-4 overflow-y-auto rounded-xl border p-3',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <PlantIcon plant={plant} size={40} decorative />
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="truncate font-semibold">{plantName(plant, language)}</h2>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
        <Button variant="ghost" size="icon" aria-label={t('details.deselect')} onClick={onClose}>
          <X />
        </Button>
      </div>

      <fieldset className="flex flex-col gap-2" aria-describedby={ids.originHint}>
        <legend className="mb-1 text-sm font-medium">{t('details.originLegend')}</legend>
        <div className="grid grid-cols-2 gap-2">
          {ORIGINS.map(({ origin, label }) => (
            <label
              key={origin}
              className={cn(
                'has-focus-visible:ring-ring/50 flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm has-focus-visible:ring-[3px] md:min-h-10',
                planting.origin === origin ? 'border-primary bg-secondary' : 'hover:bg-accent',
              )}
            >
              <input
                type="radio"
                name={ids.origin}
                className="accent-primary"
                checked={planting.origin === origin}
                onChange={() => {
                  onChange(planting, withOrigin(planting, plant, origin));
                }}
              />
              {t(label)}
            </label>
          ))}
        </div>
        <p id={ids.originHint} className="text-muted-foreground text-xs">
          {extraWeeks > 0 && plant.lifecycle.type === 'ANNUAL'
            ? t('details.extraWeeks', { count: extraWeeks })
            : t('details.sameLifecycle')}
        </p>
      </fieldset>

      {planting.origin === 'TRANSPLANT' && (
        <SowingOrigin
          planting={planting}
          plant={plant}
          sowings={sowings}
          selectId={ids.sowing}
          onChange={onChange}
        />
      )}

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted-foreground">{t('details.position')}</dt>
        <dd>{t('details.positionValue', { x: planting.x, y: planting.y })}</dd>
        <dt className="text-muted-foreground">
          {planting.origin === 'DIRECT_SOW' ? t('details.sown') : t('details.planted')}
        </dt>
        <dd>{date(planting.startDate)}</dd>
        <dt className="text-muted-foreground">{t('details.end')}</dt>
        <dd>
          {end ? date(end) : t('details.unlimited')}
          <span className="text-muted-foreground block text-xs">
            {t(`details.endSource.${source}`)}
          </span>
        </dd>
      </dl>

      <form onSubmit={saveEnd} className="flex flex-col gap-2" noValidate>
        <label htmlFor={ids.end} className="text-sm font-medium">
          {t('details.adjustEnd')}
        </label>
        <div className="flex gap-2">
          <Input
            id={ids.end}
            type="date"
            value={endValue}
            min={planting.startDate}
            aria-invalid={endError !== null}
            onChange={(event) => {
              setEndValue(event.target.value);
            }}
          />
          <Button type="submit" variant="outline" className="h-11">
            {t('details.apply')}
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          {lifecycleEnd
            ? t('details.emptyForLifecycle', { date: date(lifecycleEnd) })
            : t('details.emptyForPerennial')}
        </p>
        {endError && <FormMessage tone="error">{endError}</FormMessage>}
      </form>

      <div className="flex flex-col gap-2">
        {planting.removedDate ? (
          <>
            <p className="text-sm">
              {t('details.removedFrom', { date: date(planting.removedDate) })}
            </p>
            <Button
              variant="outline"
              className="h-11 md:h-10"
              onClick={() => {
                onChange(planting, { ...planting, removedDate: null });
              }}
            >
              <Undo2 aria-hidden />
              {t('details.restore')}
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              className="h-11 md:h-10"
              disabled={removal === null}
              onClick={() => {
                if (removal) onChange(planting, { ...planting, removedDate: removal });
              }}
            >
              <CalendarX aria-hidden />
              {t('details.removeFrom', { week: weekLabel })}
            </Button>
            <p className="text-muted-foreground text-xs">
              {removal ? t('details.removeHint') : t('details.startsLater', { week: weekLabel })}
            </p>
          </>
        )}
        <Button
          variant="outline"
          className="h-11 text-red-700 hover:text-red-800 md:h-10 dark:text-red-400 dark:hover:text-red-300"
          onClick={() => {
            onDelete(planting);
          }}
        >
          <Trash2 aria-hidden />
          {t('details.delete')}
        </Button>
      </div>
    </aside>
  );
}

/**
 * Where planted out seedlings come from: the batch with this planting's share and a link to
 * it, and a choice of the batches of the same plant (or none, e.g. bought seedlings).
 */
function SowingOrigin({
  planting,
  plant,
  sowings,
  selectId,
  onChange,
}: {
  planting: Planting;
  plant: Plant;
  sowings: readonly SowingWithPlantings[];
  selectId: string;
  onChange: (before: Planting, after: Planting) => void;
}) {
  const { t } = useTranslation('editor');
  const { language } = useLanguage();
  const text = originText(planting, sowings, plant, language);
  const choices = sowings.filter((s) => s.sowing.plantId === plant.id);
  if (!text && choices.length === 0) return null;
  // A batch that no longer exists counts as none.
  const current = text ? planting.sowingId : undefined;
  return (
    <div className="flex flex-col gap-2 text-sm">
      {text && (
        <p data-testid="sowing-origin">
          {text}.{' '}
          <Link
            to="/anzucht"
            hash={`sowing-${planting.sowingId ?? ''}`}
            className="text-foreground font-medium underline underline-offset-4"
          >
            {t('details.toSowing')}
          </Link>
        </p>
      )}
      <label htmlFor={selectId} className="font-medium">
        {t('details.fromSowing')}
      </label>
      <select
        id={selectId}
        value={current ?? ''}
        onChange={(event) => {
          onChange(planting, withSowing(planting, event.target.value || undefined));
        }}
        className="bg-card focus-visible:ring-ring/50 h-11 rounded-md border px-3 text-base outline-none focus-visible:ring-[3px] md:h-10 md:text-sm"
      >
        <option value="">{t('details.noSowing')}</option>
        {choices.map(({ sowing }) => (
          <option key={sowing.id} value={sowing.id}>
            {weekText(sowing.sowDate, language)}
          </option>
        ))}
      </select>
    </div>
  );
}
