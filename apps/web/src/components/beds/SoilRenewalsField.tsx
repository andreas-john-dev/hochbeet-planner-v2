import type { IsoDate } from '@hochbeet/contracts';
import { format, parseISO } from 'date-fns';
import { Plus, Trash2 } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { renewalYears } from '@/lib/soil-renewals';
import { useDateLocale } from '@/lib/i18n';

/** An own renewal date while editing; `key` keeps the input stable while its value changes. */
export interface RenewalEntry {
  key: number;
  value: string;
}

/**
 * "Erde erneuert am …" for the bed settings: which renewal applies per year (own dates or the
 * default 1 March, which can be taken over and changed) and the editable list of own dates.
 */
export function SoilRenewalsField({
  entries,
  today,
  error,
  onChange,
}: {
  entries: readonly RenewalEntry[];
  today: IsoDate;
  error?: string;
  onChange: (entries: RenewalEntry[]) => void;
}) {
  const { t } = useTranslation('beds');
  const locale = useDateLocale();
  // Long date of the language: "1. März 2026" or "1 March 2026".
  const formatDay = (date: IsoDate) => format(parseISO(date), 'PPP', { locale });
  const hintId = useId();
  const nextKey = () => Math.max(0, ...entries.map((e) => e.key)) + 1;
  const add = (value: string) => {
    onChange([...entries, { key: nextKey(), value }]);
  };
  const filled = entries.map((e) => e.value).filter((v) => /^\d{4}-\d{2}-\d{2}$/.test(v));

  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={hintId}>
      <legend className="mb-1 text-sm font-medium">{t('renewals.legend')}</legend>
      <ul className="flex flex-col gap-1 text-sm" aria-label={t('renewals.perYear')}>
        {renewalYears(filled, today).map(({ year, own, fallback }) => (
          <li key={year} className="flex min-h-9 items-center justify-between gap-2">
            <span>
              <span className="text-muted-foreground mr-2 tabular-nums">{year}</span>
              {own.length > 0 ? (
                own.map(formatDay).join(', ')
              ) : (
                <>
                  {formatDay(fallback)}{' '}
                  <span className="text-muted-foreground text-xs">{t('renewals.default')}</span>
                </>
              )}
            </span>
            {own.length === 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-11 md:h-9"
                aria-label={t('renewals.adjustYear', { year })}
                onClick={() => {
                  add(fallback);
                }}
              >
                {t('renewals.adjust')}
              </Button>
            )}
          </li>
        ))}
      </ul>
      {entries.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label={t('renewals.own')}>
          {entries.map((entry, index) => (
            <li key={entry.key} className="flex gap-2">
              <Input
                type="date"
                aria-label={t('renewals.entry', { number: index + 1 })}
                value={entry.value}
                onChange={(event) => {
                  onChange(
                    entries.map((e) =>
                      e.key === entry.key ? { ...e, value: event.target.value } : e,
                    ),
                  );
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={t('renewals.remove', { number: index + 1 })}
                onClick={() => {
                  onChange(entries.filter((e) => e.key !== entry.key));
                }}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Button
        type="button"
        variant="outline"
        className="h-11 self-start"
        onClick={() => {
          add(today);
        }}
      >
        <Plus aria-hidden />
        {t('renewals.add')}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
      <p id={hintId} className="text-muted-foreground text-xs">
        {t('renewals.help')}
      </p>
    </fieldset>
  );
}
