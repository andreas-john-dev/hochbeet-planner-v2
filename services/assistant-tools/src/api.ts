import {
  type BedWithPlantingsResponse,
  BedWithPlantingsResponseSchema,
  type ListBedsResponse,
  ListBedsResponseSchema,
  type ListPlantsResponse,
  ListPlantsResponseSchema,
} from '@hochbeet/contracts';
import type { z } from 'zod';

/** A tool cannot answer; the message is German and goes to the model as tool result. */
export class ToolFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ToolFailure';
  }
}

/** The read endpoints the tools use, always on behalf of one user. */
export interface GardenReader {
  listBeds(): Promise<ListBedsResponse>;
  getBed(bedId: string): Promise<BedWithPlantingsResponse>;
  listPlants(): Promise<ListPlantsResponse>;
}

/**
 * Reads through the public API (CloudFront → HTTP API) with the caller's ID token, exactly
 * like the app: the services' JWT authorizers check it and take the userId from `sub`, so a
 * user only ever sees their own beds and catalogue.
 */
export function createApiReader(
  baseUrl: string,
  token: string,
  fetchFn: typeof fetch = fetch,
): GardenReader {
  async function get<T extends z.ZodType>(path: string, schema: T): Promise<z.infer<T>> {
    let response: Response;
    try {
      response = await fetchFn(new URL(path, baseUrl), {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      throw new ToolFailure('Die Gartendaten sind gerade nicht erreichbar.');
    }
    if (response.status === 401 || response.status === 403) {
      throw new ToolFailure('Keine Berechtigung für diese Daten.');
    }
    if (response.status === 404) throw new ToolFailure('Das Beet gibt es nicht.');
    if (!response.ok) throw new ToolFailure('Die Gartendaten sind gerade nicht erreichbar.');
    const parsed = schema.safeParse(await response.json().catch(() => undefined));
    if (!parsed.success) throw new ToolFailure('Die Gartendaten sind gerade nicht lesbar.');
    return parsed.data;
  }

  return {
    listBeds: () => get('/api/garden/beds', ListBedsResponseSchema),
    getBed: (bedId) => get(`/api/garden/beds/${bedId}`, BedWithPlantingsResponseSchema),
    listPlants: () => get('/api/catalog/plants', ListPlantsResponseSchema),
  };
}
