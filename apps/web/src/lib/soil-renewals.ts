import type { IsoDate } from '@hochbeet/contracts';
import { DEFAULT_SOIL_RENEWAL } from '@hochbeet/garden-rules';

/** One year in the list of soil renewals: own dates, or the default 1 March. */
export interface RenewalYear {
  year: number;
  /** Own dates of that year, sorted; empty means the default applies. */
  own: IsoDate[];
  /** The date the rules use when there are no own dates. */
  fallback: IsoDate;
}

const yearOf = (date: IsoDate) => Number(date.slice(0, 4));

/**
 * Years to show in the bed settings: the year before and after `today`'s year, plus every
 * year with own dates. Own dates of a year replace the default for that year.
 */
export function renewalYears(renewals: readonly IsoDate[], today: IsoDate): RenewalYear[] {
  const current = yearOf(today);
  const years = new Set([current - 1, current, current + 1, ...renewals.map(yearOf)]);
  return [...years]
    .sort((a, b) => a - b)
    .map((year) => ({
      year,
      own: renewals.filter((date) => yearOf(date) === year).sort(),
      fallback: `${String(year)}-${DEFAULT_SOIL_RENEWAL}`,
    }));
}

/** Checks the edited list before saving: only real dates, each at most once. */
export function checkRenewals(
  renewals: readonly string[],
): { renewals: IsoDate[] } | { error: string } {
  const filled = renewals.filter((date) => date !== '');
  if (filled.some((date) => !/^\d{4}-\d{2}-\d{2}$/.test(date))) {
    return { error: 'Bitte ein gültiges Datum angeben.' };
  }
  if (new Set(filled).size !== filled.length)
    return { error: 'Ein Datum steht doppelt in der Liste.' };
  return { renewals: [...filled].sort() };
}
