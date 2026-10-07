import { z } from 'zod';

/** Edge length of a grid cell in cm. All positions and lengths are multiples of it. */
export const GRID_CM = 5;

export const GridCmSchema = z.number().int().multipleOf(GRID_CM);
