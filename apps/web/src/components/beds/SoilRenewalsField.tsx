import type { IsoDate } from '@hochbeet/contracts';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { Plus, Trash2 } from 'lucide-react';
import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { renewalYears } from '@/lib/soil-renewals';

/** An own renewal date while editing; `key` keeps the input stable while its value changes. */
export interface RenewalEntry {
  key: number;
  value: string;
}

const formatDay = (date: IsoDate) => format(parseISO(date), 'd. MMMM yyyy', { locale: de });

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
  const hintId = useId();
  const nextKey = () => Math.max(0, ...entries.map((e) => e.key)) + 1;
  const add = (value: string) => {
    onChange([...entries, { key: nextKey(), value }]);
  };
  const filled = entries.map((e) => e.value).filter((v) => /^\d{4}-\d{2}-\d{2}$/.test(v));

  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={hintId}>
      <legend className="mb-1 text-sm font-medium">Erde erneuert</legend>
      <ul className="flex flex-col gap-1 text-sm" aria-label="Erneuerungen je Jahr">
        {renewalYears(filled, today).map(({ year, own, fallback }) => (
          <li key={year} className="flex min-h-9 items-center justify-between gap-2">
            <span>
              <span className="text-muted-foreground mr-2 tabular-nums">{year}</span>
              {own.length > 0 ? (
                own.map(formatDay).join(', ')
              ) : (
                <>
                  {formatDay(fallback)}{' '}
                  <span className="text-muted-foreground text-xs">(Standard)</span>
                </>
              )}
            </span>
            {own.length === 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-11 md:h-9"
                aria-label={`Erneuerung ${String(year)} anpassen`}
                onClick={() => {
                  add(fallback);
                }}
              >
                Anpassen
              </Button>
            )}
          </li>
        ))}
      </ul>
      {entries.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label="Eigene Termine">
          {entries.map((entry, index) => (
            <li key={entry.key} className="flex gap-2">
              <Input
                type="date"
                aria-label={`Erneuerung ${String(index + 1)}`}
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
                aria-label={`Erneuerung ${String(index + 1)} entfernen`}
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
        Erneuerung hinzufügen
      </Button>
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
      <p id={hintId} className="text-muted-foreground text-xs">
        Die Fruchtfolge gilt nur innerhalb einer Saison, also bis die Erde erneuert wird. Ohne
        eigenen Termin gilt jedes Jahr der 1. März. Eigene Termine eines Jahres ersetzen den 1. März
        dieses Jahres; soll er bleiben, trage ihn zusätzlich ein.
      </p>
    </fieldset>
  );
}
