import type { CatalogPlant, Category, Feeder, PlantFields } from '@hochbeet/contracts';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconPicker } from '@/components/catalog/IconPicker';
import { NeighborPicker } from '@/components/catalog/NeighborPicker';
import { SowingFields } from '@/components/catalog/SowingFields';
import { FormField, FormMessage } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { apiErrorMessage } from '@/lib/api';
import { CATEGORIES, families, FEEDERS } from '@/lib/catalog';
import { useLanguage } from '@/lib/i18n';
import {
  DEFAULT_COLOR,
  LIFECYCLE_TYPES,
  type PlantForm,
  type PlantFormErrors,
  parsePlantForm,
} from '@/lib/plant-form';
import { remainingErrors, type SowingForm } from '@/lib/sowing-form';
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
  const { t } = useTranslation(['catalog', 'common']);
  const { language } = useLanguage();
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
  const updateSowing = (change: Partial<SowingForm>) => {
    setForm((current) => ({ ...current, sowing: { ...current.sowing, ...change } }));
    setErrors((current) => ({ ...current, sowing: remainingErrors(current.sowing, change) }));
  };
  const others = neighborCandidates;

  const submit = async () => {
    const parsed = parsePlantForm(form, language);
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
          label={t('form.name')}
          autoComplete="off"
          value={form.name}
          error={errors.name}
          onChange={(event) => {
            update({ name: event.target.value });
          }}
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={ids.category}>{t('form.category')}</Label>
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
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {t(`category.${category}`)}
                </option>
              ))}
            </select>
          </div>
          <FormField
            label={t('form.family')}
            autoComplete="off"
            list={ids.families}
            value={form.family}
            error={errors.family}
            hint={t('form.familyHint')}
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
            <Label htmlFor={ids.feeder}>{t('form.feeder')}</Label>
            <select
              id={ids.feeder}
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
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField
            label={t('form.spacingInRow')}
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
            label={t('form.rowSpacing')}
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
        <legend className="mb-1 text-sm font-medium">{t('form.lifecycle')}</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {LIFECYCLE_TYPES.map((type) => (
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
                <span className="text-sm font-medium">
                  {t(`form.lifecycleOption.${type}.label`)}
                </span>
                <span className="text-muted-foreground text-xs">
                  {t(`form.lifecycleOption.${type}.hint`)}
                </span>
              </span>
            </label>
          ))}
        </div>
        {form.lifecycleType !== 'PERENNIAL' && (
          <div className="max-w-56">
            <FormField
              label={form.lifecycleType === 'ANNUAL' ? t('form.cultureWeeks') : t('form.years')}
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

      <SowingFields
        value={form.sowing}
        errors={errors.sowing ?? {}}
        allowNone
        onChange={updateSowing}
      />

      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Label htmlFor={ids.color}>{t('form.color')}</Label>
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
          label={t('form.goodNeighbors')}
          tone="good"
          value={form.goodNeighbors}
          candidates={others.filter((p) => !form.badNeighbors.includes(p.id))}
          onChange={(goodNeighbors) => {
            update({ goodNeighbors });
          }}
        />
        <NeighborPicker
          label={t('form.badNeighbors')}
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
          {t('common:cancel')}
        </Button>
      </div>
    </form>
  );
}
