import {
  type CatalogPlant,
  type EvaluateBedToolOutput,
  EvaluateBedToolInputSchema,
  type FindPlantsToolOutput,
  FindPlantsToolInputSchema,
  type GetBedToolOutput,
  GetBedToolInputSchema,
  type ListBedsToolOutput,
  ListBedsToolInputSchema,
  type Planting,
  type ToolError,
} from '@hochbeet/contracts';
import { evaluateBed } from '@hochbeet/garden-rules';
import { z } from 'zod';
import { type GardenReader, ToolFailure } from './api';

/** Most plants find_plants returns; the model can narrow the query for more. */
export const MAX_PLANTS = 15;

/**
 * The tools of the gateway target. Descriptions are German, short and tell the model when
 * to use the tool; the input schemas come from packages/contracts.
 */
export const TOOL_DEFINITIONS = {
  list_beds: {
    description: 'Listet die Beete des Users mit ID, Name und Größe in cm.',
    input: ListBedsToolInputSchema,
  },
  get_bed: {
    description:
      'Liest ein Beet mit allen Pflanzungen (Sorte, Position in cm, Zeitraum), auch vergangene Jahre.',
    input: GetBedToolInputSchema,
  },
  find_plants: {
    description: `Sucht Sorten im Katalog des Users (inkl. eigener Sorten) mit Abständen, Familie, Nährstoffbedarf, Standzeit und Nachbarn. Höchstens ${String(MAX_PLANTS)} Treffer.`,
    input: FindPlantsToolInputSchema,
  },
  evaluate_bed: {
    description:
      'Prüft ein Beet mit der Regel-Engine des Planers (Abstand, Nachbarn, Starkzehrer, Fruchtfolge, Beetrand) und liefert die Hinweise.',
    input: EvaluateBedToolInputSchema,
  },
} as const;

export type ToolName = keyof typeof TOOL_DEFINITIONS;

export const isToolName = (name: string): name is ToolName => Object.hasOwn(TOOL_DEFINITIONS, name);

/** The part of JSON Schema the gateway's tool schemas use. */
export interface ToolJsonSchema {
  type?: string;
  description?: string;
  properties?: Record<string, ToolJsonSchema>;
  required?: string[];
  items?: ToolJsonSchema;
  [keyword: string]: unknown;
}

/** JSON schemas of the tool inputs, as the gateway target declares them. */
export function toolInputJsonSchemas(): Record<ToolName, ToolJsonSchema> {
  const schemas = {} as Record<ToolName, ToolJsonSchema>;
  for (const [name, { input }] of Object.entries(TOOL_DEFINITIONS)) {
    schemas[name as ToolName] = z.toJSONSchema(input, { io: 'input' }) as ToolJsonSchema;
  }
  return schemas;
}

const until = (planting: Planting) => planting.removedDate ?? planting.endDate;

const plantNames = (plants: readonly CatalogPlant[]) =>
  new Map(plants.map((plant) => [plant.id, plant.name]));

async function getBed(api: GardenReader, bedId: string): Promise<GetBedToolOutput> {
  const [{ bed, plantings }, { plants }] = await Promise.all([api.getBed(bedId), api.listPlants()]);
  const names = plantNames(plants);
  return {
    bed: {
      id: bed.id,
      name: bed.name,
      widthCm: bed.widthCm,
      depthCm: bed.depthCm,
      mainRowDirection: bed.mainRowDirection,
    },
    plantings: [...plantings]
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .map((p) => ({
        id: p.id,
        plant: names.get(p.plantId) ?? 'Unbekannte Sorte',
        kind: p.kind,
        x: p.x,
        y: p.y,
        ...(p.kind === 'ROW' ? { lengthCm: p.lengthCm, orientation: p.orientation } : {}),
        from: p.startDate,
        until: until(p),
      })),
  };
}

async function findPlants(api: GardenReader, query?: string): Promise<FindPlantsToolOutput> {
  const { plants } = await api.listPlants();
  const names = plantNames(plants);
  const needle = query?.toLocaleLowerCase('de');
  const matches = plants
    .filter((plant) => !needle || plant.name.toLocaleLowerCase('de').includes(needle))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const neighbors = (ids: readonly string[]) =>
    ids.flatMap((id) => names.get(id) ?? []).sort((a, b) => a.localeCompare(b, 'de'));
  return {
    plants: matches.slice(0, MAX_PLANTS).map((plant) => ({
      id: plant.id,
      name: plant.name,
      category: plant.category,
      family: plant.family,
      feeder: plant.feeder,
      spacingInRowCm: plant.spacingInRowCm,
      rowSpacingCm: plant.rowSpacingCm,
      lifecycle: plant.lifecycle,
      goodNeighbors: neighbors(plant.goodNeighbors),
      badNeighbors: neighbors(plant.badNeighbors),
      own: plant.source === 'OWN',
    })),
    more: Math.max(0, matches.length - MAX_PLANTS),
  };
}

async function evaluate(
  api: GardenReader,
  bedId: string,
  week?: string,
): Promise<EvaluateBedToolOutput> {
  const [{ bed, plantings }, { plants }] = await Promise.all([api.getBed(bedId), api.listPlants()]);
  const names = plantNames(plants);
  const plantOf = new Map(plantings.map((p) => [p.id, names.get(p.plantId) ?? 'Unbekannte Sorte']));
  const findings = evaluateBed(bed, plantings, plants, week ? { week } : {});
  return {
    findings: findings.map((finding) => ({
      severity: finding.severity,
      message: finding.message,
      plants: finding.plantingIds.map((id) => plantOf.get(id) ?? 'Unbekannte Sorte'),
      from: finding.period.start,
      until: finding.period.end,
    })),
  };
}

export type ToolOutput =
  ListBedsToolOutput | GetBedToolOutput | FindPlantsToolOutput | EvaluateBedToolOutput;

/**
 * Runs one tool. Invalid input and failures become `{ error }` with a German message, so the
 * agent can explain them instead of the gateway reporting an internal error.
 */
export async function runTool(
  name: ToolName,
  args: unknown,
  api: GardenReader,
): Promise<ToolOutput | ToolError> {
  try {
    switch (name) {
      case 'list_beds': {
        const { beds } = await api.listBeds();
        return {
          beds: beds.map(({ id, name, widthCm, depthCm }) => ({ id, name, widthCm, depthCm })),
        };
      }
      case 'get_bed': {
        const input = GetBedToolInputSchema.safeParse(args);
        if (!input.success) return { error: 'Bitte gib eine gültige Beet-ID an.' };
        return await getBed(api, input.data.bedId);
      }
      case 'find_plants': {
        const input = FindPlantsToolInputSchema.safeParse(args);
        if (!input.success) return { error: 'Bitte gib einen kürzeren Suchbegriff an.' };
        return await findPlants(api, input.data.query);
      }
      case 'evaluate_bed': {
        const input = EvaluateBedToolInputSchema.safeParse(args);
        if (!input.success) {
          return {
            error: 'Bitte gib eine gültige Beet-ID und optional ein Datum (JJJJ-MM-TT) an.',
          };
        }
        return await evaluate(api, input.data.bedId, input.data.week);
      }
    }
  } catch (cause) {
    if (cause instanceof ToolFailure) return { error: cause.message };
    throw cause;
  }
}
