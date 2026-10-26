import type { Bed, IsoDate, Plant, Planting, Suggestion } from '@hochbeet/contracts';
import {
  candidatePlanting,
  evaluateBed,
  isActiveInWeek,
  type Severity,
} from '@hochbeet/garden-rules';
import { TEMP_ID_PREFIX } from './placement';
import { statusByPlanting } from './warnings';

/** Prefix of the ids suggestions carry while shown; they are never saved under them. */
export const SUGGESTION_ID_PREFIX = 'suggestion-';

/** A suggestion of the assistant as it is drawn in the bed. */
export interface ShownSuggestion {
  /** Position in the list the assistant sent; stays stable when others are taken over. */
  index: number;
  suggestion: Suggestion;
  plant: Plant;
  planting: Planting;
  /** Most serious finding with the bed in the shown week, as for real plantings. */
  status?: Severity;
}

/**
 * The suggestions as plantings of `bed` (start on the Monday, end after the lifecycle), with
 * their status: the rule engine sees them together with the bed's plantings. Suggestions with
 * a plant the user does not have are left out.
 */
export function showSuggestions(
  suggestions: readonly { index: number; suggestion: Suggestion }[],
  bed: Bed,
  plantings: readonly Planting[],
  plants: readonly Plant[],
  week: IsoDate,
  lastFrost?: string,
): ShownSuggestion[] {
  const byId = new Map(plants.map((plant) => [plant.id, plant]));
  const shown = suggestions.flatMap(({ index, suggestion }) => {
    const plant = byId.get(suggestion.plantId);
    if (!plant) return [];
    const planting = candidatePlanting(
      suggestion,
      bed,
      plant,
      `${SUGGESTION_ID_PREFIX}${String(index)}`,
    );
    return [{ index, suggestion, plant, planting }];
  });
  const findings = evaluateBed(
    bed,
    [...plantings, ...shown.map((s) => s.planting)],
    plants,
    lastFrost ? { lastFrost } : {},
  ).filter((f) => isActiveInWeek(f.period, week));
  const statuses = statusByPlanting(findings);
  return shown.map((s) => {
    const status = statuses.get(s.planting.id);
    return status ? { ...s, status } : s;
  });
}

/** The planting to create when the user takes a suggestion over (temporary id until saved). */
export function adoptedPlanting(shown: ShownSuggestion): Planting {
  return { ...shown.planting, id: `${TEMP_ID_PREFIX}${crypto.randomUUID()}` };
}
