import { z } from 'zod';
import { messageKey } from './messages';

/** Edge length of a grid cell in cm. Positions and lengths are multiples of it. */
export const GRID_CM = 5;

/** Length or coordinate on the 5 cm grid, in cm. */
export const GridCmSchema = z
  .number()
  .int()
  .nonnegative()
  .multipleOf(GRID_CM, messageKey('gridMultiple', { step: GRID_CM }));

/** ULID in Crockford base32, e.g. 01J9ZQ3W8D6V2K5M7N8P9R0S1T. */
export const UlidSchema = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/, messageKey('ulid'));
export type Ulid = z.infer<typeof UlidSchema>;

function parseIsoDate(value: string): Date | undefined {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value
    ? undefined
    : date;
}

/** Calendar date as ISO string `YYYY-MM-DD`. */
export const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, messageKey('dateFormat'))
  .refine((value) => parseIsoDate(value) !== undefined, messageKey('dateInvalid'));
export type IsoDate = z.infer<typeof IsoDateSchema>;

/** ISO date that falls on a Monday: plantings start and end with whole ISO weeks. */
export const MondaySchema = IsoDateSchema.refine(
  (value) => parseIsoDate(value)?.getUTCDay() === 1,
  messageKey('monday'),
);

/** `H` = parallel to the bed width (x axis), `V` = parallel to the bed depth (y axis). */
export const DirectionSchema = z.enum(['H', 'V']);
export type Direction = z.infer<typeof DirectionSchema>;

/** ISO-8601 calendar week number. */
export const IsoWeekSchema = z
  .number()
  .int(messageKey('weekWhole'))
  .min(1, messageKey('weekRange'))
  .max(53, messageKey('weekRange'));

/**
 * Recurring window of ISO weeks, both ends included, e.g. sowing from week 10 to 14.
 * `from > to` wraps around the turn of the year (week 40 to 8).
 */
export const WeekWindowSchema = z.object({ from: IsoWeekSchema, to: IsoWeekSchema });
export type WeekWindow = z.infer<typeof WeekWindowSchema>;

/** Whether an ISO week number lies in the window, also across the turn of the year. */
export function isWeekInWindow(week: number, window: WeekWindow): boolean {
  return window.from <= window.to
    ? week >= window.from && week <= window.to
    : week >= window.from || week <= window.to;
}
