import type { Bed, CandidatePlanting, Plant, Planting } from '@hochbeet/contracts';
import { lifecycleEnd, weekStart } from './time';

/** Row length when a candidate row comes without one. */
export const DEFAULT_CANDIDATE_ROW_CM = 50;

/**
 * A planned planting (e.g. an assistant's suggestion) as a planting of `bed`: it starts on the
 * Monday of its week and ends after the plant's lifecycle, like a planting placed by hand.
 * Rows without orientation follow the bed's main row direction.
 */
export function candidatePlanting(
  candidate: CandidatePlanting,
  bed: Pick<Bed, 'id' | 'mainRowDirection'>,
  plant: Pick<Plant, 'id' | 'lifecycle'>,
  id: string,
): Planting {
  const startDate = weekStart(candidate.startDate);
  const base = {
    id,
    bedId: bed.id,
    plantId: plant.id,
    x: candidate.x,
    y: candidate.y,
    startDate,
    endDate: lifecycleEnd(startDate, plant.lifecycle),
    removedDate: null,
  };
  if (candidate.kind === 'SINGLE') return { ...base, kind: 'SINGLE' };
  return {
    ...base,
    kind: 'ROW',
    orientation: candidate.orientation ?? bed.mainRowDirection,
    lengthCm: candidate.lengthCm ?? DEFAULT_CANDIDATE_ROW_CM,
  };
}
