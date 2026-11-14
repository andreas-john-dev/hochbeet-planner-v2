import {
  type CatalogPlant,
  DEFAULT_LAST_FROST,
  type SowingBatch,
  SowingBatchFieldsSchema,
  type SowingStage,
} from '@hochbeet/contracts';
import { weekStart } from '@hochbeet/garden-rules';
import { PlantIcon } from '@hochbeet/plant-icons/react';
import { Search } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FormField, FormMessage } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiErrorMessage } from '@/lib/api';
import { useGardenSettings, useSaveSowing } from '@/lib/garden';
import { monthDayText } from '@/lib/garden-settings';
import { useLanguage } from '@/lib/i18n';
import {
  defaultStage,
  defaultTransplantDate,
  plantsForSowing,
  STAGES,
  weekText,
} from '@/lib/sowings';
import { cn } from '@/lib/utils';

const selectClass =
  'bg-card focus-visible:ring-ring/50 h-11 rounded-md border px-3 text-base outline-none focus-visible:ring-[3px] md:h-9 md:text-sm';

/**
 * Create or edit a sowing batch. New batches pick the plant from a search (plants raised
 * indoors first) and get the planting out prefilled from the raising time and, for frost
 * sensitive plants, the last frost; editing also changes stage and stock.
 */
export function SowingFormDialog({
  sowing,
  plants,
  open,
  onOpenChange,
}: {
  sowing?: SowingBatch;
  plants: readonly CatalogPlant[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation('sowings');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{sowing ? t('form.editTitle') : t('form.createTitle')}</DialogTitle>
          <DialogDescription>{t('form.description')}</DialogDescription>
        </DialogHeader>
        {/* Mounted per opening, so every opening starts with fresh values. */}
        <SowingForm
          sowing={sowing}
          plants={plants}
          onDone={() => {
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

interface FormState {
  plantId: string;
  sowDate: string;
  sownCount: string;
  aliveCount: string;
  stage: SowingStage;
  location: string;
  plannedTransplantDate: string;
  notes: string;
}

function initialState(sowing: SowingBatch | undefined, today: Date): FormState {
  const sowDate = sowing?.sowDate ?? weekStart(today);
  return {
    plantId: sowing?.plantId ?? '',
    sowDate,
    sownCount: String(sowing?.sownCount ?? ''),
    aliveCount: String(sowing?.aliveCount ?? 0),
    stage: sowing?.stage ?? defaultStage(sowDate, today),
    location: sowing?.location ?? '',
    plannedTransplantDate: sowing?.plannedTransplantDate ?? '',
    notes: sowing?.notes ?? '',
  };
}

/** A number field's text as a number; empty or not a number fails the schema. */
const toNumber = (text: string) => (text.trim() === '' ? Number.NaN : Number(text));

function SowingForm({
  sowing,
  plants,
  onDone,
}: {
  sowing: SowingBatch | undefined;
  plants: readonly CatalogPlant[];
  onDone: () => void;
}) {
  const { t } = useTranslation(['sowings', 'common']);
  const { language } = useLanguage();
  const save = useSaveSowing();
  const lastFrost = useGardenSettings().data?.lastFrost ?? DEFAULT_LAST_FROST;
  const [today] = useState(() => new Date());
  const [form, setForm] = useState(() => initialState(sowing, today));
  // The planting out follows plant and sowing week until the user sets it.
  const [transplantSet, setTransplantSet] = useState(!!sowing);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const plant = plants.find((p) => p.id === form.plantId);

  const update = (changes: Partial<FormState>) => {
    setForm((current) => {
      const next = { ...current, ...changes };
      const chosen = plants.find((p) => p.id === next.plantId);
      if (!transplantSet && chosen && next.sowDate) {
        next.plannedTransplantDate = defaultTransplantDate(chosen, next.sowDate, lastFrost) ?? '';
      }
      if (!sowing && changes.sowDate) next.stage = defaultStage(next.sowDate, today);
      return next;
    });
  };

  const onSubmit = async () => {
    const fields = {
      plantId: form.plantId,
      sowDate: form.sowDate,
      sownCount: toNumber(form.sownCount),
      // Before germination there are no seedlings; the stock starts at the sown amount then.
      aliveCount: sowing ? toNumber(form.aliveCount) : 0,
      stage: form.stage,
      ...(form.location.trim() ? { location: form.location.trim() } : {}),
      ...(form.plannedTransplantDate ? { plannedTransplantDate: form.plannedTransplantDate } : {}),
      ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
    };
    const parsed = SowingBatchFieldsSchema.safeParse(fields);
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [
            String(issue.path[0]),
            issue.path[0] === 'plantId' ? t('form.plantRequired') : issue.message,
          ]),
        ),
      );
      return;
    }
    setErrors({});
    await save.mutateAsync({ id: sowing?.id, fields: parsed.data });
    onDone();
  };

  const frostHint =
    plant?.frostSensitive && !transplantSet
      ? t('form.frostHint', { date: monthDayText(lastFrost, language) })
      : '';
  const transplantHint =
    form.plannedTransplantDate && plant?.sowing?.propagationWeeks && !transplantSet
      ? t('form.transplantHint', { count: plant.sowing.propagationWeeks.max, frost: frostHint })
      : form.plannedTransplantDate
        ? weekText(form.plannedTransplantDate)
        : t('form.optional');

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit().catch(() => undefined);
      }}
      noValidate
      className="flex flex-col gap-4"
    >
      {save.isError && <FormMessage tone="error">{apiErrorMessage(save.error)}</FormMessage>}
      <PlantPicker
        plants={plants}
        value={form.plantId}
        error={errors.plantId}
        onChange={(plantId) => {
          update({ plantId });
        }}
      />
      <FormField
        label={t('form.sowWeek')}
        type="date"
        required
        value={form.sowDate}
        hint={form.sowDate ? weekText(form.sowDate) : undefined}
        error={errors.sowDate}
        onChange={(event) => {
          // Sown in a week: the date becomes its Monday.
          const value = event.target.value;
          update({ sowDate: value ? weekStart(value) : '' });
        }}
      />
      <div className="grid grid-cols-2 gap-3">
        <FormField
          label={t('form.sownCount')}
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          required
          value={form.sownCount}
          error={errors.sownCount}
          onChange={(event) => {
            update({ sownCount: event.target.value });
          }}
        />
        {sowing && (
          <FormField
            label={t('form.stock')}
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={form.aliveCount}
            error={errors.aliveCount}
            onChange={(event) => {
              update({ aliveCount: event.target.value });
            }}
          />
        )}
      </div>
      {sowing && (
        <StageSelect
          value={form.stage}
          onChange={(stage) => {
            update({ stage });
          }}
        />
      )}
      <FormField
        label={t('form.location')}
        autoComplete="off"
        placeholder={t('form.locationPlaceholder')}
        maxLength={60}
        value={form.location}
        error={errors.location}
        onChange={(event) => {
          update({ location: event.target.value });
        }}
      />
      <FormField
        label={t('form.transplant')}
        type="date"
        value={form.plannedTransplantDate}
        hint={transplantHint}
        error={errors.plannedTransplantDate}
        onChange={(event) => {
          setTransplantSet(true);
          const value = event.target.value;
          // Set directly: `update` would still fill in the default in this render.
          setForm((current) => ({
            ...current,
            plannedTransplantDate: value ? weekStart(value) : '',
          }));
        }}
      />
      <NotesField
        value={form.notes}
        error={errors.notes}
        onChange={(notes) => {
          update({ notes });
        }}
      />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          {t('common:cancel')}
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {sowing ? t('common:save') : t('form.submitCreate')}
        </Button>
      </DialogFooter>
    </form>
  );
}

const normalize = (text: string) => text.toLocaleLowerCase('de').trim();

/** Search and pick one plant; plants raised indoors come first. */
function PlantPicker({
  plants,
  value,
  error,
  onChange,
}: {
  plants: readonly CatalogPlant[];
  value: string;
  error: string | undefined;
  onChange: (plantId: string) => void;
}) {
  const { t } = useTranslation('sowings');
  const ids = { search: useId(), error: useId() };
  const [query, setQuery] = useState('');
  const shown = plantsForSowing(plants).filter(
    (p) => p.id === value || normalize(p.name).includes(normalize(query)),
  );
  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={error ? ids.error : undefined}>
      <legend className="mb-1 text-sm font-medium">{t('form.plant')}</legend>
      <div className="relative">
        <label htmlFor={ids.search} className="sr-only">
          {t('form.search')}
        </label>
        <Search
          aria-hidden
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        />
        <Input
          id={ids.search}
          type="search"
          placeholder={t('form.search')}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          className="pl-9"
        />
      </div>
      <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-md border p-1">
        {shown.map((plant) => (
          <li key={plant.id}>
            <label
              className={cn(
                'flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 text-sm',
                plant.id === value ? 'bg-secondary text-secondary-foreground' : 'hover:bg-accent',
              )}
            >
              <input
                type="radio"
                name={ids.search}
                className="accent-primary"
                checked={plant.id === value}
                onChange={() => {
                  onChange(plant.id);
                }}
              />
              <PlantIcon plant={plant} size={24} decorative />
              <span className="flex-1 truncate">{plant.name}</span>
              {plant.sowing && plant.sowing.method !== 'DIRECT' && (
                <span className="text-muted-foreground text-xs">{t('form.presow')}</span>
              )}
            </label>
          </li>
        ))}
        {shown.length === 0 && (
          <li className="text-muted-foreground px-2 py-3 text-sm">{t('form.noPlant')}</li>
        )}
      </ul>
      {error && (
        <p id={ids.error} className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </fieldset>
  );
}

function StageSelect({
  value,
  onChange,
}: {
  value: SowingStage;
  onChange: (stage: SowingStage) => void;
}) {
  const { t } = useTranslation('sowings');
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{t('form.stage')}</Label>
      <select
        id={id}
        className={selectClass}
        value={value}
        onChange={(event) => {
          onChange(event.target.value as SowingStage);
        }}
      >
        {STAGES.map((stage) => (
          <option key={stage} value={stage}>
            {t(`stage.${stage}`)}
          </option>
        ))}
      </select>
    </div>
  );
}

function NotesField({
  value,
  error,
  onChange,
}: {
  value: string;
  error: string | undefined;
  onChange: (notes: string) => void;
}) {
  const { t } = useTranslation('sowings');
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{t('form.notes')}</Label>
      <textarea
        id={id}
        rows={2}
        maxLength={500}
        value={value}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className="bg-card focus-visible:ring-ring/50 rounded-md border px-3 py-2 text-base outline-none focus-visible:ring-[3px] md:text-sm"
      />
      {error && (
        <p id={`${id}-error`} className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
