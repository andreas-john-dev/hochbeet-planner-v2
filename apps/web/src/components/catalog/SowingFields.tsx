import type { SowingMethod } from '@hochbeet/contracts';
import { ChevronDown } from 'lucide-react';
import { type ReactNode, useId, useState } from 'react';
import { FormField } from '@/components/FormField';
import { SOWING_METHOD_LABEL, weekHint } from '@/lib/sowing';
import { type SowingErrors, type SowingForm, usesField } from '@/lib/sowing-form';
import { cn } from '@/lib/utils';

const METHODS: { method: SowingMethod; hint: string }[] = [
  { method: 'DIRECT', hint: 'Wird direkt ins Beet gesät, z. B. Möhren.' },
  { method: 'PRESOW', hint: 'Wird vorgezogen und als Jungpflanze gesetzt, z. B. Tomaten.' },
  { method: 'BOTH', hint: 'Geht beides, z. B. Salat.' },
];

/** Hint under a week field: where the week roughly lies in the year. */
function weekFieldHint(value: string, end = false): string {
  const week = Number(value);
  return value.trim() !== '' && Number.isInteger(week) && week >= 1 && week <= 53
    ? weekHint(week, { end })
    : 'KW 1 bis 53';
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
  const ids = { method: useId(), frost: useId() };
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
        Aussaat & Anzucht
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
            <span className="text-sm font-medium">Frostempfindlich</span>
            <span className="text-muted-foreground text-xs">
              Kommt erst nach dem letzten Frost ins Freie, z. B. nach den Eisheiligen.
            </span>
          </span>
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Aussaat</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {allowNone && (
              <MethodOption
                name={ids.method}
                label="Keine Angaben"
                hint="Ohne Aussaatdaten."
                checked={value.method === null}
                onSelect={() => {
                  onChange({ method: null });
                }}
              />
            )}
            {METHODS.map(({ method, hint }) => (
              <MethodOption
                key={method}
                name={ids.method}
                label={SOWING_METHOD_LABEL[method]}
                hint={hint}
                checked={value.method === method}
                onSelect={() => {
                  onChange({ method });
                }}
              />
            ))}
          </div>
        </fieldset>

        {uses('presowFrom') && (
          <Group title="Vorkultur">
            <FormField
              label="Aussaat ab KW"
              min={1}
              max={53}
              hint={weekFieldHint(value.presowFrom)}
              {...number('presowFrom')}
            />
            <FormField
              label="Aussaat bis KW"
              min={1}
              max={53}
              hint={weekFieldHint(value.presowTo, true)}
              {...number('presowTo')}
            />
            <FormField
              label="Vorkultur von (Wochen)"
              min={1}
              max={26}
              hint="Bis zum Auspflanzen"
              {...number('propagationMin')}
            />
            <FormField
              label="Vorkultur bis (Wochen)"
              min={1}
              max={26}
              {...number('propagationMax')}
            />
            <FormField
              label="Pikieren nach (Wochen)"
              min={1}
              max={12}
              hint="Optional"
              {...number('prickOutWeeks')}
            />
          </Group>
        )}

        {uses('directFrom') && (
          <Group title="Direktsaat">
            <FormField
              label="Aussaat ab KW"
              min={1}
              max={53}
              hint={weekFieldHint(value.directFrom)}
              {...number('directFrom')}
            />
            <FormField
              label="Aussaat bis KW"
              min={1}
              max={53}
              hint={weekFieldHint(value.directTo, true)}
              {...number('directTo')}
            />
            <FormField
              label="Länger im Beet (Wochen)"
              min={0}
              max={26}
              hint="Optional: Keimen und erste Wochen, kommt bei Direktsaat zur Kulturdauer dazu"
              {...number('directSowExtraWeeks')}
            />
          </Group>
        )}

        {value.method !== null && (
          <Group title="Keimung (optional)">
            <FormField
              label="Keimdauer von (Tage)"
              min={1}
              max={60}
              {...number('germinationDaysMin')}
            />
            <FormField
              label="Keimdauer bis (Tage)"
              min={1}
              max={60}
              {...number('germinationDaysMax')}
            />
            <FormField
              label="Keimtemperatur von (°C)"
              min={0}
              max={40}
              {...number('germinationTempMin')}
            />
            <FormField
              label="Keimtemperatur bis (°C)"
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
