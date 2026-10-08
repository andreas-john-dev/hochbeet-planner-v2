import type { CatalogPlant, Feeder, Lifecycle } from '@hochbeet/contracts';
import { useId, useState } from 'react';
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
  FEEDER_LABEL,
  overrideFor,
  parseAdjustForm,
} from '@/lib/catalog';
import { useAdjustPlant } from '@/lib/garden';

const LIFECYCLE_LABEL: Record<Lifecycle['type'], string> = {
  ANNUAL: 'Wochen',
  MULTI_YEAR: 'Jahre',
  PERENNIAL: 'Dauerkultur',
};

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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{plant.name} für mich anpassen</DialogTitle>
          <DialogDescription>
            Die Werte gelten nur für dich, auch in deinen Beeten. Abstände in Zentimetern.
          </DialogDescription>
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

  const onSubmit = async () => {
    const parsed = parseAdjustForm(form);
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
          label="Abstand in der Reihe"
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
          label="Reihenabstand"
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
          <Label htmlFor={feederId}>Bedarf</Label>
          <select
            id={feederId}
            value={form.feeder}
            onChange={(event) => {
              update({ feeder: event.target.value as Feeder });
            }}
            className={selectClass}
          >
            {(Object.keys(FEEDER_LABEL) as Feeder[]).map((feeder) => (
              <option key={feeder} value={feeder}>
                {FEEDER_LABEL[feeder]}
              </option>
            ))}
          </select>
        </div>
        <FormField
          label="Familie"
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
          <Label htmlFor={lifecycleId}>Standzeit in</Label>
          <select
            id={lifecycleId}
            value={form.lifecycleType}
            onChange={(event) => {
              update({ lifecycleType: event.target.value as Lifecycle['type'] });
            }}
            className={selectClass}
          >
            {(Object.keys(LIFECYCLE_LABEL) as Lifecycle['type'][]).map((type) => (
              <option key={type} value={type}>
                {LIFECYCLE_LABEL[type]}
              </option>
            ))}
          </select>
        </div>
        {form.lifecycleType !== 'PERENNIAL' && (
          <FormField
            label={form.lifecycleType === 'ANNUAL' ? 'Standzeit (Wochen)' : 'Standzeit (Jahre)'}
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
      <DialogFooter>
        <Button type="button" variant="outline" className="h-11 md:h-9" onClick={onDone}>
          Abbrechen
        </Button>
        <Button type="submit" className="h-11 md:h-9" disabled={adjust.isPending}>
          Speichern
        </Button>
      </DialogFooter>
    </form>
  );
}
