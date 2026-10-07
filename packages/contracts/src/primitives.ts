import { z } from 'zod';

/** Edge length of a grid cell in cm. Positions and lengths are multiples of it. */
export const GRID_CM = 5;

/** Length or coordinate on the 5 cm grid, in cm. */
export const GridCmSchema = z
  .number()
  .int()
  .nonnegative()
  .multipleOf(GRID_CM, `Muss ein Vielfaches von ${String(GRID_CM)} cm sein.`);

/** ULID in Crockford base32, e.g. 01J9ZQ3W8D6V2K5M7N8P9R0S1T. */
export const UlidSchema = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/, 'Keine gültige ULID.');
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
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum im Format JJJJ-MM-TT erwartet.')
  .refine((value) => parseIsoDate(value) !== undefined, 'Kein gültiges Datum.');
export type IsoDate = z.infer<typeof IsoDateSchema>;

/** ISO date that falls on a Monday: plantings start and end with whole ISO weeks. */
export const MondaySchema = IsoDateSchema.refine(
  (value) => parseIsoDate(value)?.getUTCDay() === 1,
  'Muss ein Montag sein.',
);

/** `H` = parallel to the bed width (x axis), `V` = parallel to the bed depth (y axis). */
export const DirectionSchema = z.enum(['H', 'V']);
export type Direction = z.infer<typeof DirectionSchema>;
