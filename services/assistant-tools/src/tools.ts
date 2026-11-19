import {
  type CandidatePlanting,
  type CatalogPlant,
  DEFAULT_LOCALE,
  familyName,
  type EvaluateBedToolOutput,
  EvaluateBedToolInputSchema,
  type FindPlantsToolOutput,
  type GardenView,
  FindPlantsToolInputSchema,
  type GetBedToolOutput,
  GetBedToolInputSchema,
  type ListBedsToolOutput,
  ListBedsToolInputSchema,
  type ListSowingsToolOutput,
  ListSowingsToolInputSchema,
  type Locale,
  type Planting,
  plantName,
  type Sowing,
  type ToolError,
} from '@hochbeet/contracts';
import {
  batchStock,
  bounds,
  candidatePlanting,
  evaluateBed,
  footprint,
  plannedCount,
  rangeText,
  windowText,
} from '@hochbeet/garden-rules';
import { z } from 'zod';
import { type GardenReader, ToolFailure } from './api';
import { toolMessage } from './messages';

/** Most plants find_plants returns; the model can narrow the query for more. */
export const MAX_PLANTS = 15;

/** Most batches list_sowings returns, the current ones first. */
export const MAX_SOWINGS = 20;

/**
 * The tools of the gateway target. Descriptions are German, short and tell the model when
 * to use the tool; the input schemas come from packages/contracts. What the tools return
 * (plant names, findings, windows, errors) is in the language of the request (`locale`).
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
    description: `Sucht Sorten im Katalog des Users (inkl. eigener Sorten) mit Abständen, Familie, Nährstoffbedarf, Standzeit, Nachbarn und Anzucht. Höchstens ${String(MAX_PLANTS)} Treffer.`,
    input: FindPlantsToolInputSchema,
  },
  list_sowings: {
    description:
      'Listet die Anzucht-Chargen des Users (Sorte, Aussaatwoche, Phase, Bestand, verplant, frei) und seinen letzten Frosttermin für frostempfindliche Sorten.',
    input: ListSowingsToolInputSchema,
  },
  evaluate_bed: {
    description:
      'Prüft ein Beet mit der Regel-Engine des Planers (Abstand, Nachbarn, Starkzehrer, Fruchtfolge, Beetrand), optional zusammen mit geplanten Pflanzungen, und liefert die Hinweise.',
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

/** Plant names by id in `locale` (English names of global plants, else the stored name). */
const plantNames = (plants: readonly CatalogPlant[], locale: Locale) =>
  new Map(plants.map((plant) => [plant.id, plantName(plant, locale)]));

async function getBed(api: GardenReader, bedId: string, locale: Locale): Promise<GetBedToolOutput> {
  const [{ bed, plantings }, { plants }] = await Promise.all([api.getBed(bedId), api.listPlants()]);
  const names = plantNames(plants, locale);
  const byId = new Map(plants.map((plant) => [plant.id, plant]));
  const area = (planting: (typeof plantings)[number]) => {
    const plant = byId.get(planting.plantId);
    if (!plant) return {};
    const box = bounds(footprint(planting, plant));
    const cm = (value: number) => Math.round(value);
    return { area: { x0: cm(box.x0), y0: cm(box.y0), x1: cm(box.x1), y1: cm(box.y1) } };
  };
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
        plant: names.get(p.plantId) ?? toolMessage('unknownPlant', locale),
        kind: p.kind,
        x: p.x,
        y: p.y,
        ...(p.kind === 'ROW' ? { lengthCm: p.lengthCm, orientation: p.orientation } : {}),
        from: p.startDate,
        until: until(p),
        ...area(p),
      })),
  };
}

/** The raising details of a plant, windows with months so the model need not convert weeks. */
function sowingOf(sowing: Sowing, locale: Locale) {
  const { method, presowWeeks, propagationWeeks, prickOutWeeks, directSowWeeks } = sowing;
  return {
    method,
    ...(presowWeeks ? { presow: windowText(presowWeeks, undefined, locale) } : {}),
    ...(propagationWeeks
      ? { propagationWeeks: rangeText(propagationWeeks.min, propagationWeeks.max) }
      : {}),
    ...(prickOutWeeks === undefined ? {} : { prickOutWeeks }),
    ...(directSowWeeks ? { directSow: windowText(directSowWeeks, undefined, locale) } : {}),
  };
}

/**
 * Plants by German or English name, sorted by the stored name. `name`/`family` are the stored
 * values, `nameEn`/`familyEn` the English ones; neighbours are named in `locale`.
 */
async function findPlants(
  api: GardenReader,
  locale: Locale,
  query?: string,
): Promise<FindPlantsToolOutput> {
  const { plants } = await api.listPlants();
  const names = plantNames(plants, locale);
  const needle = query?.toLocaleLowerCase('de');
  const matches = plants
    .filter(
      (plant) =>
        !needle ||
        [plant.name, plantName(plant, 'en')].some((name) =>
          name.toLocaleLowerCase('de').includes(needle),
        ),
    )
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const neighbors = (ids: readonly string[]) =>
    ids.flatMap((id) => names.get(id) ?? []).sort((a, b) => a.localeCompare(b, locale));
  return {
    plants: matches.slice(0, MAX_PLANTS).map((plant) => ({
      id: plant.id,
      name: plant.name,
      nameEn: plantName(plant, 'en'),
      category: plant.category,
      family: plant.family,
      familyEn: familyName(plant, 'en'),
      feeder: plant.feeder,
      spacingInRowCm: plant.spacingInRowCm,
      rowSpacingCm: plant.rowSpacingCm,
      lifecycle: plant.lifecycle,
      goodNeighbors: neighbors(plant.goodNeighbors),
      badNeighbors: neighbors(plant.badNeighbors),
      own: plant.source === 'OWN',
      frostSensitive: plant.frostSensitive ?? false,
      ...(plant.sowing ? { sowing: sowingOf(plant.sowing, locale) } : {}),
    })),
    more: Math.max(0, matches.length - MAX_PLANTS),
  };
}

/**
 * The user's batches with what is left of them, counted like the app (`plannedCount()`), and
 * the last frost. Current batches first by sowing week, finished ones after, newest first.
 */
async function listSowings(
  api: GardenReader,
  locale: Locale,
  query?: string,
): Promise<ListSowingsToolOutput> {
  const [{ sowings }, { plants }, { lastFrost }] = await Promise.all([
    api.listSowings(),
    api.listPlants(),
    api.getSettings(),
  ]);
  const names = plantNames(plants, locale);
  const byId = new Map(plants.map((plant) => [plant.id, plant]));
  const needle = query?.toLocaleLowerCase('de');
  const nameOf = (plantId: string) => names.get(plantId) ?? toolMessage('unknownPlant', locale);
  // Found by the German and the English name, whatever the language.
  const matchesQuery = (plantId: string) => {
    const plant = byId.get(plantId);
    const candidates = plant ? [plant.name, plantName(plant, 'en')] : [nameOf(plantId)];
    return candidates.some((name) => name.toLocaleLowerCase('de').includes(needle ?? ''));
  };
  const done = (stage: string) => (stage === 'DONE' ? 1 : 0);
  const matches = sowings
    .filter(({ sowing }) => !needle || matchesQuery(sowing.plantId))
    .sort(
      ({ sowing: a }, { sowing: b }) =>
        done(a.stage) - done(b.stage) ||
        (a.stage === 'DONE'
          ? b.sowDate.localeCompare(a.sowDate)
          : a.sowDate.localeCompare(b.sowDate)) ||
        nameOf(a.plantId).localeCompare(nameOf(b.plantId), locale),
    );
  return {
    lastFrost,
    sowings: matches.slice(0, MAX_SOWINGS).map((item) => {
      const { sowing } = item;
      const stock = batchStock(sowing);
      const planned = plannedCount(item, plants);
      return {
        plant: nameOf(sowing.plantId),
        sowWeek: sowing.sowDate,
        stage: sowing.stage,
        stock,
        ...(planned === undefined ? {} : { planned, free: stock - planned }),
        ...(sowing.plannedTransplantDate
          ? { plannedTransplantWeek: sowing.plannedTransplantDate }
          : {}),
        ...(sowing.location ? { location: sowing.location } : {}),
      };
    }),
    more: Math.max(0, matches.length - MAX_SOWINGS),
  };
}

/** Id of a candidate planting while it is checked; never stored. */
const candidateId = (index: number) => `candidate-${String(index)}`;

/**
 * Findings of a bed, optionally with candidates. In the simple view (`view: 'SIMPLE'`) only
 * the spatial rules run, on the plantings of `week` (today's week without one), like in the
 * app's simple view: no crop rotation, soil renewal, frost or raising findings.
 */
async function evaluate(
  api: GardenReader,
  locale: Locale,
  bedId: string,
  week?: string,
  candidates: readonly CandidatePlanting[] = [],
  view: GardenView = 'EXPERT',
): Promise<EvaluateBedToolOutput> {
  // The user's last frost, so the frost hint matches what the app shows.
  const [{ bed, plantings }, { plants }, { lastFrost }] = await Promise.all([
    api.getBed(bedId),
    api.listPlants(),
    api.getSettings(),
  ]);
  const names = plantNames(plants, locale);
  const byId = new Map(plants.map((plant) => [plant.id, plant]));
  const unknownCandidates: number[] = [];
  const planned = candidates.flatMap((candidate, index) => {
    const plant = byId.get(candidate.plantId);
    if (!plant) {
      unknownCandidates.push(index);
      return [];
    }
    return [candidatePlanting(candidate, bed, plant, candidateId(index))];
  });
  const all = [...plantings, ...planned];
  const unknown = toolMessage('unknownPlant', locale);
  const plantOf = new Map(all.map((p) => [p.id, names.get(p.plantId) ?? unknown]));
  const indexOf = new Map(planned.map((p) => [p.id, Number(p.id.slice('candidate-'.length))]));
  // Messages in `locale`, with the plants' names and families in it, like the app.
  const findings = evaluateBed(bed, all, plants, {
    lastFrost,
    ...(view === 'SIMPLE'
      ? { scope: 'SIMPLE' as const, week: week ?? new Date() }
      : week
        ? { week }
        : {}),
    locale,
    // By id: the rule engine may hand over a copy without `global` (adjusted plants).
    plantName: (plant) => names.get(plant.id) ?? plant.name,
    familyName: (plant) => {
      const own = byId.get(plant.id);
      return own ? familyName(own, locale) : plant.family;
    },
  });
  return {
    findings: findings.map((finding) => ({
      severity: finding.severity,
      message: finding.message,
      plants: finding.plantingIds.map((id) => plantOf.get(id) ?? unknown),
      from: finding.period.start,
      until: finding.period.end,
      candidates: finding.plantingIds.flatMap((id) => indexOf.get(id) ?? []),
    })),
    unknownCandidates,
  };
}

export type ToolOutput =
  | ListBedsToolOutput
  | GetBedToolOutput
  | FindPlantsToolOutput
  | EvaluateBedToolOutput
  | ListSowingsToolOutput;

/**
 * Runs one tool with texts in `locale`. Invalid input and failures become `{ error }` with a
 * message in `locale`, so the agent can explain them instead of the gateway reporting an
 * internal error.
 */
export async function runTool(
  name: ToolName,
  args: unknown,
  api: GardenReader,
  locale: Locale = DEFAULT_LOCALE,
): Promise<ToolOutput | ToolError> {
  const error = (key: Parameters<typeof toolMessage>[0]) => ({ error: toolMessage(key, locale) });
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
        if (!input.success) return error('invalidBedId');
        return await getBed(api, input.data.bedId, locale);
      }
      case 'find_plants': {
        const input = FindPlantsToolInputSchema.safeParse(args);
        if (!input.success) return error('queryTooLong');
        return await findPlants(api, locale, input.data.query);
      }
      case 'evaluate_bed': {
        const input = EvaluateBedToolInputSchema.safeParse(args);
        if (!input.success) return error('invalidEvaluation');
        return await evaluate(
          api,
          locale,
          input.data.bedId,
          input.data.week,
          input.data.candidates,
          input.data.view,
        );
      }
      case 'list_sowings': {
        const input = ListSowingsToolInputSchema.safeParse(args);
        if (!input.success) return error('queryTooLong');
        return await listSowings(api, locale, input.data.query);
      }
    }
  } catch (cause) {
    if (cause instanceof ToolFailure) return error(cause.key);
    throw cause;
  }
}
