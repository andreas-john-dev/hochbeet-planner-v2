import { weekHint } from '@hochbeet/garden-rules';
import { ChevronDown } from 'lucide-react';
import { type ReactNode, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FormField } from '@/components/FormField';
import { useLanguage } from '@/lib/i18n';
import type { Language } from '@/lib/language';
import { SOWING_METHODS } from '@/lib/sowing';
import { type SowingErrors, type SowingForm, usesField } from '@/lib/sowing-form';
import { cn } from '@/lib/utils';

/**
 * Hint under a week field: where the week roughly lies in the year ("Anfang März", "early
 * March"), else the allowed weeks.
 */
function weekFieldHint(value: string, fallback: string, language: Language, end = false): string {
  const week = Number(value);
  return value.trim() !== '' && Number.isInteger(week) && week >= 1 && week <= 53
    ? weekHint(week, { end, locale: language })
    : fallback;
}

/**
 * "Aussaat & Anzucht": frost sensitivity, sowing method, windows in calendar weeks and the
 * optional details. Collapsible, open when the plant already has details.
 */
export function SowingFields({
  value,
  errors,
  allowNone,
  onChange,
}: {
  value: SowingForm;
  errors: SowingErrors;
  /** False for adjustments of a global plant with details: they can be changed, not removed. */
  allowNone: boolean;
  onChange: (change: Partial<SowingForm>) => void;
}) {
  const { t } = useTranslation('catalog');
  const { language } = useLanguage();
  const ids = { method: useId(), frost: useId() };
  const weekRange = t('sowingFields.weekRange');
  // Open when the plant has details; afterwards the user decides, errors open it again.
  const [open, setOpen] = useState(value.method !== null || value.frostSensitive);
  const hasErrors = Object.keys(errors).length > 0;
  const number = (key: Exclude<keyof SowingForm, 'frostSensitive' | 'method'>) => ({
    type: 'number',
    inputMode: 'numeric' as const,
    value: value[key],
    error: errors[key],
    onChange: (event: { target: { value: string } }) => {
      onChange({ [key]: event.target.value });
    },
  });
  const uses = (key: Parameters<typeof usesField>[1]) => usesField(value.method, key);

  return (
    <details
      className="group rounded-lg border"
      open={open || hasErrors}
      onToggle={(event) => {
        setOpen(event.currentTarget.open);
      }}
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-sm font-medium md:min-h-9 [&::-webkit-details-marker]:hidden">
        {t('sowingFields.title')}
        <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180" />
      </summary>
      <div className="flex flex-col gap-4 border-t p-3">
        <label htmlFor={ids.frost} className="flex cursor-pointer items-start gap-3">
          <input
            id={ids.frost}
            type="checkbox"
            className="accent-primary mt-1 size-4"
            checked={value.frostSensitive}
            onChange={(event) => {
              onChange({ frostSensitive: event.target.checked });
            }}
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">{t('sowingFields.frostSensitive')}</span>
            <span className="text-muted-foreground text-xs">{t('sowingFields.frostHint')}</span>
          </span>
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">{t('sowingFields.sowing')}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {allowNone && (
              <MethodOption
                name={ids.method}
                label={t('sowingFields.none')}
                hint={t('sowingFields.noneHint')}
                checked={value.method === null}
                onSelect={() => {
                  onChange({ method: null });
                }}
              />
            )}
            {SOWING_METHODS.map((method) => (
              <MethodOption
                key={method}
                name={ids.method}
                label={t(`method.${method}`)}
                hint={t(`sowingFields.methodHint.${method}`)}
                checked={value.method === method}
                onSelect={() => {
                  onChange({ method });
                }}
              />
            ))}
          </div>
        </fieldset>

        {uses('presowFrom') && (
          <Group title={t('sowingFields.presow')}>
            <FormField
              label={t('sowingFields.sowFrom')}
              min={1}
              max={53}
              hint={weekFieldHint(value.presowFrom, weekRange, language)}
              {...number('presowFrom')}
            />
            <FormField
              label={t('sowingFields.sowTo')}
              min={1}
              max={53}
              hint={weekFieldHint(value.presowTo, weekRange, language, true)}
              {...number('presowTo')}
            />
            <FormField
              label={t('sowingFields.propagationMin')}
              min={1}
              max={26}
              hint={t('sowingFields.propagationHint')}
              {...number('propagationMin')}
            />
            <FormField
              label={t('sowingFields.propagationMax')}
              min={1}
              max={26}
              {...number('propagationMax')}
            />
            <FormField
              label={t('sowingFields.prickOut')}
              min={1}
              max={12}
              hint={t('sowingFields.optional')}
              {...number('prickOutWeeks')}
            />
          </Group>
        )}

        {uses('directFrom') && (
          <Group title={t('sowingFields.direct')}>
            <FormField
              label={t('sowingFields.sowFrom')}
              min={1}
              max={53}
              hint={weekFieldHint(value.directFrom, weekRange, language)}
              {...number('directFrom')}
            />
            <FormField
              label={t('sowingFields.sowTo')}
              min={1}
              max={53}
              hint={weekFieldHint(value.directTo, weekRange, language, true)}
              {...number('directTo')}
            />
            <FormField
              label={t('sowingFields.extraWeeks')}
              min={0}
              max={26}
              hint={t('sowingFields.extraWeeksHint')}
              {...number('directSowExtraWeeks')}
            />
          </Group>
        )}

        {value.method !== null && (
          <Group title={t('sowingFields.germination')}>
            <FormField
              label={t('sowingFields.germinationDaysMin')}
              min={1}
              max={60}
              {...number('germinationDaysMin')}
            />
            <FormField
              label={t('sowingFields.germinationDaysMax')}
              min={1}
              max={60}
              {...number('germinationDaysMax')}
            />
            <FormField
              label={t('sowingFields.germinationTempMin')}
              min={0}
              max={40}
              {...number('germinationTempMin')}
            />
            <FormField
              label={t('sowingFields.germinationTempMax')}
              min={0}
              max={40}
              {...number('germinationTempMax')}
            />
          </Group>
        )}
      </div>
    </details>
  );
}

function MethodOption({
  name,
  label,
  hint,
  checked,
  onSelect,
}: {
  name: string;
  label: string;
  hint: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      className={cn(
        'has-focus-visible:ring-ring/50 flex cursor-pointer gap-3 rounded-lg border p-3 has-focus-visible:ring-[3px]',
        checked ? 'border-primary bg-secondary' : 'hover:bg-accent',
      )}
    >
      <input
        type="radio"
        name={name}
        className="accent-primary mt-1"
        checked={checked}
        onChange={onSelect}
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-muted-foreground text-xs">{hint}</span>
      </span>
    </label>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">{title}</legend>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </fieldset>
  );
}
