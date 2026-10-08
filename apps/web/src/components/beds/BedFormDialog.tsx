import { zodResolver } from '@hookform/resolvers/zod';
import { type Bed, BedFieldsSchema, type Direction } from '@hochbeet/contracts';
import { defaultMainRowDirection } from '@hochbeet/garden-rules';
import * as RadioGroup from '@radix-ui/react-radio-group';
import { useEffect, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';
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
import { useSaveBed } from '@/lib/garden';
import { cn } from '@/lib/utils';
import { RowDirectionSketch } from './RowDirectionSketch';

const bedFormSchema = BedFieldsSchema.omit({ soilRenewals: true });
type BedForm = z.infer<typeof bedFormSchema>;

const directions: { value: Direction; label: string; hint: string }[] = [
  { value: 'H', label: 'Parallel zur Breite', hint: 'Reihen laufen von links nach rechts.' },
  { value: 'V', label: 'Parallel zur Tiefe', hint: 'Reihen laufen von vorn nach hinten.' },
];

const NEW_BED: BedForm = { name: '', widthCm: 200, depthCm: 100, mainRowDirection: 'V' };

/**
 * Create or edit a bed: name, size and main row direction. Until the user picks a direction,
 * it follows the default: parallel to the shorter edge, so rows run across the bed.
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{bed ? 'Beet bearbeiten' : 'Beet anlegen'}</DialogTitle>
          <DialogDescription>
            Maße in Zentimetern, in 5-cm-Schritten. Du kannst alles später ändern.
          </DialogDescription>
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
  const save = useSaveBed();
  const [directionChosen, setDirectionChosen] = useState(!!bed);
  const form = useForm<BedForm>({
    resolver: zodResolver(bedFormSchema),
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
    await save.mutateAsync({
      id: bed?.id,
      fields: { ...fields, soilRenewals: bed?.soilRenewals ?? [] },
    });
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
        label="Name"
        autoComplete="off"
        error={errors.name?.message}
        {...form.register('name')}
      />
      <div className="grid grid-cols-2 gap-3">
        <FormField
          label="Breite (cm)"
          type="number"
          inputMode="numeric"
          min={5}
          step={5}
          error={errors.widthCm?.message}
          {...form.register('widthCm', { valueAsNumber: true })}
        />
        <FormField
          label="Tiefe (cm)"
          type="number"
          inputMode="numeric"
          min={5}
          step={5}
          error={errors.depthCm?.message}
          {...form.register('depthCm', { valueAsNumber: true })}
        />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Reihenrichtung</legend>
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
              aria-label="Reihenrichtung"
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
                      {label}
                      {value === suggested && (
                        <span className="text-primary ml-1.5 text-xs font-normal">Standard</span>
                      )}
                    </span>
                    <span className="text-muted-foreground text-xs">{hint}</span>
                  </span>
                </Label>
              ))}
            </RadioGroup.Root>
          )}
        />
        <p className="text-muted-foreground text-xs">
          Standard ist parallel zur kürzeren Kante: Die Reihen laufen quer übers Beet, in einem 2 ×
          1 m Beet also 1 m lang. Neue Reihen übernehmen diese Richtung.
        </p>
      </fieldset>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Abbrechen
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {bed ? 'Speichern' : 'Beet anlegen'}
        </Button>
      </DialogFooter>
    </form>
  );
}
