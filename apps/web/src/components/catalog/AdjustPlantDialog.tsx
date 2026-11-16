import type { CatalogPlant, Feeder, Lifecycle } from '@hochbeet/contracts';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SowingFields } from '@/components/catalog/SowingFields';
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
import { Label } from '@/components/ui/label';
import { apiErrorMessage } from '@/lib/api';
import {
  adjustForm,
  type AdjustErrors,
  type AdjustForm,
  FEEDERS,
  overrideFor,
  parseAdjustForm,
} from '@/lib/catalog';
import { useAdjustPlant } from '@/lib/garden';
import { useLanguage } from '@/lib/i18n';
import { LIFECYCLE_TYPES } from '@/lib/plant-form';
import { usePlantNames } from '@/lib/plant-names';
import { remainingErrors, type SowingForm } from '@/lib/sowing-form';

const selectClass =
  'bg-card focus-visible:ring-ring/50 h-11 rounded-md border px-3 text-base outline-none focus-visible:ring-[3px] md:h-9 md:text-sm';

/** "Für mich anpassen": edits the user's overlay of a global plant. */
export function AdjustPlantDialog({
  plant,
  open,
  onOpenChange,
}: {
  plant: CatalogPlant;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation('catalog');
  const { plantName } = usePlantNames();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('adjust.title', { name: plantName(plant) })}</DialogTitle>
          <DialogDescription>{t('adjust.description')}</DialogDescription>
        </DialogHeader>
        {/* Mounted per opening, so every opening starts with the current values. */}
        <AdjustPlantForm
          plant={plant}
          onDone={() => {
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function AdjustPlantForm({ plant, onDone }: { plant: CatalogPlant; onDone: () => void }) {
  const { t } = useTranslation(['catalog', 'common']);
  const { language } = useLanguage();
  const adjust = useAdjustPlant(plant.id);
  const [form, setForm] = useState<AdjustForm>(() => adjustForm(plant));
  const [errors, setErrors] = useState<AdjustErrors>({});
  const feederId = useId();
  const lifecycleId = useId();
  const update = (change: Partial<AdjustForm>) => {
    setForm((current) => ({ ...current, ...change }));
    // A field's message goes away as soon as the field is edited.
    setErrors((current) =>
      Object.fromEntries(Object.entries(current).filter(([key]) => !(key in change))),
    );
  };

  const updateSowing = (change: Partial<SowingForm>) => {
    setForm((current) => ({ ...current, sowing: { ...current.sowing, ...change } }));
    setErrors((current) => ({ ...current, sowing: remainingErrors(current.sowing, change) }));
  };
  // Details of the global plant can be changed but not removed: an adjustment only adds values.
  const allowNone = (plant.global ?? plant).sowing === undefined;

  const onSubmit = async () => {
    const parsed = parseAdjustForm(form, language);
    if ('errors' in parsed) {
      setErrors(parsed.errors);
      return;
    }
    setErrors({});
    await adjust.mutateAsync(overrideFor(plant, parsed.fields));
    onDone();
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit().catch(() => undefined);
      }}
      noValidate
      className="flex flex-col gap-4"
    >
      {adjust.isError && <FormMessage tone="error">{apiErrorMessage(adjust.error)}</FormMessage>}
      <div className="grid grid-cols-2 gap-3">
        <FormField
          label={t('adjust.spacingInRow')}
          type="number"
          inputMode="numeric"
          min={1}
          max={300}
          value={form.spacingInRowCm}
          error={errors.spacingInRowCm}
          onChange={(event) => {
            update({ spacingInRowCm: event.target.value });
          }}
        />
        <FormField
          label={t('adjust.rowSpacing')}
          type="number"
          inputMode="numeric"
          min={1}
          max={300}
          value={form.rowSpacingCm}
          error={errors.rowSpacingCm}
          onChange={(event) => {
            update({ rowSpacingCm: event.target.value });
          }}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={feederId}>{t('detail.feeder')}</Label>
          <select
            id={feederId}
            value={form.feeder}
            onChange={(event) => {
              update({ feeder: event.target.value as Feeder });
            }}
            className={selectClass}
          >
            {FEEDERS.map((feeder) => (
              <option key={feeder} value={feeder}>
                {t(`feeder.${feeder}`)}
              </option>
            ))}
          </select>
        </div>
        <FormField
          label={t('detail.family')}
          autoComplete="off"
          value={form.family}
          error={errors.family}
          onChange={(event) => {
            update({ family: event.target.value });
          }}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={lifecycleId}>{t('adjust.lifecycleIn')}</Label>
          <select
            id={lifecycleId}
            value={form.lifecycleType}
            onChange={(event) => {
              update({ lifecycleType: event.target.value as Lifecycle['type'] });
            }}
            className={selectClass}
          >
            {LIFECYCLE_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`adjust.lifecycleUnit.${type}`)}
              </option>
            ))}
          </select>
        </div>
        {form.lifecycleType !== 'PERENNIAL' && (
          <FormField
            label={
              form.lifecycleType === 'ANNUAL'
                ? t('adjust.lifecycleWeeks')
                : t('adjust.lifecycleYears')
            }
            type="number"
            inputMode="numeric"
            min={1}
            value={form.lifecycleValue}
            error={errors.lifecycleValue}
            onChange={(event) => {
              update({ lifecycleValue: event.target.value });
            }}
          />
        )}
      </div>
      <SowingFields
        value={form.sowing}
        errors={errors.sowing ?? {}}
        allowNone={allowNone}
        onChange={updateSowing}
      />
      <DialogFooter>
        <Button type="button" variant="outline" className="h-11 md:h-9" onClick={onDone}>
          {t('common:cancel')}
        </Button>
        <Button type="submit" className="h-11 md:h-9" disabled={adjust.isPending}>
          {t('common:save')}
        </Button>
      </DialogFooter>
    </form>
  );
}
