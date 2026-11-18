import { zodResolver } from '@hookform/resolvers/zod';
import { type Bed, BedFieldsSchema, type Direction } from '@hochbeet/contracts';
import { defaultMainRowDirection } from '@hochbeet/garden-rules';
import * as RadioGroup from '@radix-ui/react-radio-group';
import { formatISO } from 'date-fns';
import { useEffect, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';
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
import { Label } from '@/components/ui/label';
import { apiErrorMessage } from '@/lib/api';
import { withContractMessages } from '@/lib/form-errors';
import { useSaveBed } from '@/lib/garden';
import { cn } from '@/lib/utils';
import { checkRenewals } from '@/lib/soil-renewals';
import { useView } from '@/lib/view';
import { RowDirectionSketch } from './RowDirectionSketch';
import { type RenewalEntry, SoilRenewalsField } from './SoilRenewalsField';
import { useLanguage } from '@/lib/i18n';

const bedFormSchema = BedFieldsSchema.omit({ soilRenewals: true });
type BedForm = z.infer<typeof bedFormSchema>;

const directions = [
  { value: 'H', label: 'form.directionH', hint: 'form.directionHHint' },
  { value: 'V', label: 'form.directionV', hint: 'form.directionVHint' },
] as const satisfies readonly { value: Direction; label: string; hint: string }[];

const NEW_BED: BedForm = { name: '', widthCm: 200, depthCm: 100, mainRowDirection: 'V' };

/**
 * Create or edit a bed: name, size, main row direction and soil renewals. Until the user picks
 * a direction, it follows the default: parallel to the shorter edge, so rows run across the bed.
 * The simple view has no soil renewals; saving keeps the bed's dates as they are.
 */
export function BedFormDialog({
  bed,
  open,
  onOpenChange,
}: {
  bed?: Bed;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation('beds');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{bed ? t('form.editTitle') : t('form.createTitle')}</DialogTitle>
          <DialogDescription>{t('form.description')}</DialogDescription>
        </DialogHeader>
        {/* Mounted per opening, so every opening starts with fresh values. */}
        <BedForm
          bed={bed}
          onDone={() => {
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function BedForm({ bed, onDone }: { bed: Bed | undefined; onDone: () => void }) {
  const { t } = useTranslation(['beds', 'common']);
  const { language } = useLanguage();
  const save = useSaveBed();
  const simple = useView().view === 'SIMPLE';
  const [directionChosen, setDirectionChosen] = useState(!!bed);
  const [today] = useState(() => formatISO(new Date(), { representation: 'date' }));
  const [renewals, setRenewals] = useState<RenewalEntry[]>(() =>
    (bed?.soilRenewals ?? []).map((value, key) => ({ key, value })),
  );
  const [renewalError, setRenewalError] = useState<string | undefined>();
  const form = useForm<BedForm>({
    resolver: withContractMessages(zodResolver(bedFormSchema), language),
    defaultValues: bed ?? NEW_BED,
  });
  const { errors } = form.formState;
  const [widthCm, depthCm, direction] = useWatch({
    control: form.control,
    name: ['widthCm', 'depthCm', 'mainRowDirection'],
  });
  const suggested = defaultMainRowDirection({ widthCm, depthCm });

  useEffect(() => {
    if (!directionChosen) form.setValue('mainRowDirection', suggested);
  }, [directionChosen, suggested, form]);

  const onSubmit = form.handleSubmit(async (fields) => {
    if (simple) {
      await save.mutateAsync({
        id: bed?.id,
        fields: { ...fields, soilRenewals: bed?.soilRenewals ?? [] },
      });
      onDone();
      return;
    }
    const checked = checkRenewals(
      renewals.map((r) => r.value),
      language,
    );
    if ('error' in checked) {
      setRenewalError(checked.error);
      return;
    }
    setRenewalError(undefined);
    await save.mutateAsync({ id: bed?.id, fields: { ...fields, soilRenewals: checked.renewals } });
    onDone();
  });

  return (
    <form
      onSubmit={(e) => void onSubmit(e).catch(() => undefined)}
      noValidate
      className="flex flex-col gap-4"
    >
      {save.isError && <FormMessage tone="error">{apiErrorMessage(save.error)}</FormMessage>}
      <FormField
        label={t('form.name')}
        autoComplete="off"
        error={errors.name?.message}
        {...form.register('name')}
      />
      <div className="grid grid-cols-2 gap-3">
        <FormField
          label={t('form.width')}
          type="number"
          inputMode="numeric"
          min={5}
          step={5}
          error={errors.widthCm?.message}
          {...form.register('widthCm', { valueAsNumber: true })}
        />
        <FormField
          label={t('form.depth')}
          type="number"
          inputMode="numeric"
          min={5}
          step={5}
          error={errors.depthCm?.message}
          {...form.register('depthCm', { valueAsNumber: true })}
        />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">{t('form.rowDirection')}</legend>
        <Controller
          control={form.control}
          name="mainRowDirection"
          render={({ field }) => (
            <RadioGroup.Root
              value={field.value}
              onValueChange={(value) => {
                setDirectionChosen(true);
                field.onChange(value);
              }}
              className="grid gap-2 sm:grid-cols-2"
              aria-label={t('form.rowDirection')}
            >
              {directions.map(({ value, label, hint }) => (
                <Label
                  key={value}
                  htmlFor={`direction-${value}`}
                  className={cn(
                    'hover:bg-accent flex cursor-pointer items-center gap-3 rounded-lg border p-3 font-normal',
                    direction === value && 'border-primary bg-secondary',
                  )}
                >
                  <RadioGroup.Item
                    id={`direction-${value}`}
                    value={value}
                    className="border-primary focus-visible:ring-ring/50 grid size-4 shrink-0 place-items-center rounded-full border outline-none focus-visible:ring-[3px]"
                  >
                    <RadioGroup.Indicator className="bg-primary size-2 rounded-full" />
                  </RadioGroup.Item>
                  <RowDirectionSketch widthCm={widthCm} depthCm={depthCm} direction={value} />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">
                      {t(label)}
                      {value === suggested && (
                        <span className="text-primary ml-1.5 text-xs font-normal">
                          {t('form.default')}
                        </span>
                      )}
                    </span>
                    <span className="text-muted-foreground text-xs">{t(hint)}</span>
                  </span>
                </Label>
              ))}
            </RadioGroup.Root>
          )}
        />
        <p className="text-muted-foreground text-xs">{t('form.directionHelp')}</p>
      </fieldset>
      {!simple && (
        <SoilRenewalsField
          entries={renewals}
          today={today}
          error={renewalError}
          onChange={setRenewals}
        />
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          {t('common:cancel')}
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {bed ? t('common:save') : t('form.submitCreate')}
        </Button>
      </DialogFooter>
    </form>
  );
}
