import type { CatalogPlant, Category, Feeder, PlantFields } from '@hochbeet/contracts';
import { useId, useState } from 'react';
import { IconPicker } from '@/components/catalog/IconPicker';
import { NeighborPicker } from '@/components/catalog/NeighborPicker';
import { FormField, FormMessage } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { apiErrorMessage } from '@/lib/api';
import { CATEGORY_LABEL, families, FEEDER_LABEL } from '@/lib/catalog';
import {
  DEFAULT_COLOR,
  LIFECYCLE_OPTIONS,
  type PlantForm,
  type PlantFormErrors,
  parsePlantForm,
} from '@/lib/plant-form';
import { cn } from '@/lib/utils';

const selectClass =
  'bg-card focus-visible:ring-ring/50 h-11 rounded-md border px-3 text-base outline-none focus-visible:ring-[3px] md:h-9 md:text-sm';

/**
 * All fields of a plant: for own plants, global plants and corrections before a publication.
 * Checks the input and hands valid plant fields to `onSubmit`.
 */
export function PlantFormFields({
  initial,
  catalog,
  neighborCandidates,
  submitLabel,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  initial: PlantForm;
  /** The catalogue, for family suggestions and icon names. */
  catalog: readonly CatalogPlant[];
  /** Plants that may become neighbours (never the plant itself). */
  neighborCandidates: readonly CatalogPlant[];
  submitLabel: string;
  pending: boolean;
  /** Failure of the last save, shown above the form. */
  error: unknown;
  onSubmit: (fields: PlantFields) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<PlantForm>(initial);
  const [errors, setErrors] = useState<PlantFormErrors>({});
  const ids = {
    category: useId(),
    feeder: useId(),
    families: useId(),
    color: useId(),
    lifecycle: useId(),
  };
  const update = (change: Partial<PlantForm>) => {
    setForm((current) => ({ ...current, ...change }));
    // A field's message goes away as soon as the field is edited.
    setErrors((current) =>
      Object.fromEntries(Object.entries(current).filter(([key]) => !(key in change))),
    );
  };
  const others = neighborCandidates;

  const submit = async () => {
    const parsed = parsePlantForm(form);
    if ('errors' in parsed) {
      setErrors(parsed.errors);
      return;
    }
    setErrors({});
    await onSubmit(parsed.fields);
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit().catch(() => undefined);
      }}
      noValidate
      className="flex max-w-2xl flex-col gap-6"
    >
      {error != null && <FormMessage tone="error">{apiErrorMessage(error)}</FormMessage>}

      <section className="flex flex-col gap-4">
        <FormField
          label="Name"
          autoComplete="off"
          value={form.name}
          error={errors.name}
          onChange={(event) => {
            update({ name: event.target.value });
          }}
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={ids.category}>Kategorie</Label>
            <select
              id={ids.category}
              value={form.category}
              onChange={(event) => {
                const category = event.target.value as Category;
                // Keep a colour the user chose; follow the category otherwise.
                const color =
                  form.color === DEFAULT_COLOR[form.category]
                    ? DEFAULT_COLOR[category]
                    : form.color;
                update({ category, color });
              }}
              className={selectClass}
            >
              {(Object.keys(CATEGORY_LABEL) as Category[]).map((category) => (
                <option key={category} value={category}>
                  {CATEGORY_LABEL[category]}
                </option>
              ))}
            </select>
          </div>
          <FormField
            label="Familie"
            autoComplete="off"
            list={ids.families}
            value={form.family}
            error={errors.family}
            hint="Grundlage der Fruchtfolge"
            onChange={(event) => {
              update({ family: event.target.value });
            }}
          />
          <datalist id={ids.families}>
            {families(catalog).map((family) => (
              <option key={family} value={family} />
            ))}
          </datalist>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={ids.feeder}>Bedarf</Label>
            <select
              id={ids.feeder}
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
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField
            label="Abstand in der Reihe (cm)"
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
            label="Reihenabstand (cm)"
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
      </section>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Standzeit</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {LIFECYCLE_OPTIONS.map(({ type, label, hint }) => (
            <label
              key={type}
              className={cn(
                'has-focus-visible:ring-ring/50 flex cursor-pointer gap-3 rounded-lg border p-3 has-focus-visible:ring-[3px]',
                form.lifecycleType === type ? 'border-primary bg-secondary' : 'hover:bg-accent',
              )}
            >
              <input
                type="radio"
                name={ids.lifecycle}
                className="accent-primary mt-1"
                checked={form.lifecycleType === type}
                onChange={() => {
                  update({ lifecycleType: type });
                }}
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{label}</span>
                <span className="text-muted-foreground text-xs">{hint}</span>
              </span>
            </label>
          ))}
        </div>
        {form.lifecycleType !== 'PERENNIAL' && (
          <div className="max-w-56">
            <FormField
              label={form.lifecycleType === 'ANNUAL' ? 'Kulturdauer (Wochen)' : 'Standzeit (Jahre)'}
              type="number"
              inputMode="numeric"
              min={1}
              value={form.lifecycleValue}
              error={errors.lifecycleValue}
              onChange={(event) => {
                update({ lifecycleValue: event.target.value });
              }}
            />
          </div>
        )}
      </fieldset>

      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Label htmlFor={ids.color}>Farbe im Beet</Label>
          <input
            id={ids.color}
            type="color"
            value={form.color}
            onChange={(event) => {
              update({ color: event.target.value });
            }}
            className="h-11 w-16 cursor-pointer rounded-md border bg-transparent p-1 md:h-9"
          />
        </div>
        <IconPicker
          value={form.icon}
          category={form.category}
          catalog={catalog}
          onChange={(icon) => {
            update({ icon });
          }}
        />
      </section>

      <section className="grid gap-6 sm:grid-cols-2">
        <NeighborPicker
          label="Gute Nachbarn"
          tone="good"
          value={form.goodNeighbors}
          candidates={others.filter((p) => !form.badNeighbors.includes(p.id))}
          onChange={(goodNeighbors) => {
            update({ goodNeighbors });
          }}
        />
        <NeighborPicker
          label="Schlechte Nachbarn"
          tone="bad"
          value={form.badNeighbors}
          candidates={others.filter((p) => !form.goodNeighbors.includes(p.id))}
          onChange={(badNeighbors) => {
            update({ badNeighbors });
          }}
        />
      </section>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="h-11" disabled={pending}>
          {submitLabel}
        </Button>
        <Button type="button" variant="outline" className="h-11" onClick={onCancel}>
          Abbrechen
        </Button>
      </div>
    </form>
  );
}
