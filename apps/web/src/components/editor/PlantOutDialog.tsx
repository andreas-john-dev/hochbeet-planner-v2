import type { Plant } from '@hochbeet/contracts';
import { formatWeek, plantCount } from '@hochbeet/garden-rules';
import { useId, useState } from 'react';
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
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { type PlantingKind, rowLengthFor } from '@/lib/editor/placement';
import type { PreviewSowing } from '@/lib/editor/store';
import { cn } from '@/lib/utils';

export interface PlantOutRequest {
  plant: Plant;
  sowing: PreviewSowing;
  at: { x: number; y: number };
}

const KINDS: readonly { value: PlantingKind; label: string }[] = [
  { value: 'ROW', label: 'Als Reihe' },
  { value: 'SINGLE', label: 'Als Einzelpflanzen' },
];

/**
 * „Wie viele?“ after dropping seedlings from a sowing batch into the bed: how many (all free
 * ones by default) and whether as one row of the right length or as single plants along
 * the row direction. A dialog on wide screens, a bottom sheet on phones.
 */
export function PlantOutDialog({
  request,
  defaultKind,
  sheet,
  onConfirm,
  onCancel,
}: {
  request: PlantOutRequest | null;
  defaultKind: PlantingKind;
  /** Bottom sheet instead of a dialog (phones). */
  sheet: boolean;
  onConfirm: (kind: PlantingKind, count: number) => void;
  onCancel: () => void;
}) {
  const open = request !== null;
  const onOpenChange = (next: boolean) => {
    if (!next) onCancel();
  };
  const title = request ? `${request.plant.name} auspflanzen` : '';
  const description = request
    ? `Aus der Anzucht vom ${formatWeek(request.sowing.sowDate).range}, ${String(request.sowing.free)} frei.`
    : '';
  const form = request && (
    // Mounted per request, so every drop starts with all free seedlings.
    <PlantOutForm
      key={`${request.sowing.id}-${String(request.at.x)}-${String(request.at.y)}`}
      request={request}
      defaultKind={defaultKind}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );

  return sheet ? (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetTitle>{title}</SheetTitle>
        <SheetDescription>{description}</SheetDescription>
        {form}
      </SheetContent>
    </Sheet>
  ) : (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {form}
      </DialogContent>
    </Dialog>
  );
}

function PlantOutForm({
  request,
  defaultKind,
  onConfirm,
  onCancel,
}: {
  request: PlantOutRequest;
  defaultKind: PlantingKind;
  onConfirm: (kind: PlantingKind, count: number) => void;
  onCancel: () => void;
}) {
  const { plant, sowing } = request;
  const ids = { count: useId(), kind: useId(), hint: useId() };
  const [countText, setCountText] = useState(String(sowing.free));
  const [kind, setKind] = useState<PlantingKind>(defaultKind);
  const count = Number(countText);
  const valid = Number.isInteger(count) && count >= 1 && count <= sowing.free;
  const lengthCm = valid ? rowLengthFor(count, plant.spacingInRowCm) : 0;
  const inRow = valid ? plantCount({ kind: 'ROW', lengthCm }, plant) : 0;
  const hint = !valid
    ? `1 bis ${String(sowing.free)} Pflanzen.`
    : kind === 'ROW'
      ? `Reihe von ${String(lengthCm)} cm mit ${String(inRow)} ${inRow === 1 ? 'Pflanze' : 'Pflanzen'}, ${String(plant.spacingInRowCm)} cm Abstand.`
      : `${String(count)} ${count === 1 ? 'Einzelpflanze' : 'Einzelpflanzen'} im Abstand von ${String(plant.spacingInRowCm)} cm entlang der Reihenrichtung.`;

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) onConfirm(kind, count);
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={ids.count}>Wie viele?</Label>
        <Input
          id={ids.count}
          type="number"
          inputMode="numeric"
          min={1}
          max={sowing.free}
          step={1}
          value={countText}
          aria-invalid={!valid}
          aria-describedby={ids.hint}
          onChange={(event) => {
            setCountText(event.target.value);
          }}
        />
      </div>
      <fieldset className="flex flex-col gap-2" aria-describedby={ids.hint}>
        <legend className="sr-only">Pflanzart</legend>
        <div className="grid grid-cols-2 gap-2">
          {KINDS.map(({ value, label }) => (
            <label
              key={value}
              className={cn(
                'has-focus-visible:ring-ring/50 flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm has-focus-visible:ring-[3px]',
                kind === value ? 'border-primary bg-secondary' : 'hover:bg-accent',
              )}
            >
              <input
                type="radio"
                name={ids.kind}
                className="accent-primary"
                checked={kind === value}
                onChange={() => {
                  setKind(value);
                }}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <p
        id={ids.hint}
        className={cn(
          'text-sm',
          valid ? 'text-muted-foreground' : 'text-red-700 dark:text-red-400',
        )}
      >
        {hint}
      </p>
      <DialogFooter>
        <Button type="button" variant="outline" className="h-11 md:h-10" onClick={onCancel}>
          Abbrechen
        </Button>
        <Button type="submit" className="h-11 md:h-10" disabled={!valid}>
          Auspflanzen
        </Button>
      </DialogFooter>
    </form>
  );
}
