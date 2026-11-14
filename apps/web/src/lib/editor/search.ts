import { IsoDateSchema } from '@hochbeet/contracts';
import { weekStart } from '@hochbeet/garden-rules';

/** Search params of the bed editor: `woche` opens it on that week (its Monday). */
export interface BedEditorSearch {
  woche?: string | undefined;
}

export function parseBedEditorSearch(search: unknown): BedEditorSearch {
  const value =
    typeof search === 'object' && search !== null
      ? (search as Record<string, unknown>).woche
      : undefined;
  const date = IsoDateSchema.safeParse(value);
  return { woche: date.success ? weekStart(date.data) : undefined };
}
