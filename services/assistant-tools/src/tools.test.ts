import {
  EvaluateBedToolOutputSchema,
  FindPlantsToolOutputSchema,
  GetBedToolOutputSchema,
  ListBedsToolOutputSchema,
  ListSowingsToolOutputSchema,
} from '@hochbeet/contracts';
import type { Logger } from '@hochbeet/service-kit';
import { describe, expect, it, vi } from 'vitest';
import { createApiReader } from './api';
import { createToolHandler, tokenOf, toolNameOf } from './handler';
import { interceptRequest, TOKEN_ARGUMENT } from './interceptor';
import { bed, catalog, fakeApi, planting, plantId, sowing, tokenFor } from './test-utils';
import { MAX_PLANTS, MAX_SOWINGS, runTool, toolInputJsonSchemas, TOOL_DEFINITIONS } from './tools';

const BED_A = '01J9ZQ3W8D6V2K5M7N8P9R0S1A';
const BED_B = '01J9ZQ3W8D6V2K5M7N8P9R0S1B';

const SOWING_LETTUCE = '01J9ZQ3W8D6V2K5M7N8P9R0W01';

const lettuce = sowing(SOWING_LETTUCE, 'Kopfsalat', {
  sowDate: '2026-03-16',
  sownCount: 24,
  aliveCount: 18,
  stage: 'PRICKED',
  location: 'Fensterbank',
  plannedTransplantDate: '2026-04-20',
});
// One single plant and a row of 50 cm (25 cm in the row: three plants) from the batch.
lettuce.plantings = [
  { id: '01J9ZQ3W8D6V2K5M7N8P9R0T04', bedId: BED_A, startDate: '2026-04-20', kind: 'SINGLE' },
  {
    id: '01J9ZQ3W8D6V2K5M7N8P9R0T05',
    bedId: BED_A,
    startDate: '2026-04-20',
    kind: 'ROW',
    lengthCm: 50,
  },
];

const gardens = {
  'user-a': {
    beds: [bed(BED_A, 'Hochbeet Süd')],
    plantings: [
      planting('01J9ZQ3W8D6V2K5M7N8P9R0T01', BED_A, 'Tomate', { x: 30, y: 40 }),
      planting('01J9ZQ3W8D6V2K5M7N8P9R0T02', BED_A, 'Tomate', { x: 45, y: 40 }),
    ],
    sowings: [
      sowing('01J9ZQ3W8D6V2K5M7N8P9R0W02', 'Tomate', { stage: 'DONE', sowDate: '2025-03-03' }),
      lettuce,
      sowing('01J9ZQ3W8D6V2K5M7N8P9R0W03', 'Paprika', { stage: 'PLANNED', sownCount: 6 }),
      sowing('01J9ZQ3W8D6V2K5M7N8P9R0W04', 'Tomate', { stage: 'DONE', sowDate: '2026-03-09' }),
    ],
  },
  'user-b': {
    beds: [bed(BED_B, 'Geheimbeet')],
    plantings: [planting('01J9ZQ3W8D6V2K5M7N8P9R0T03', BED_B, 'Kartoffel', { x: 50, y: 40 })],
    sowings: [sowing('01J9ZQ3W8D6V2K5M7N8P9R0W05', 'Lauch')],
  },
};

const silent: Logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: () => silent,
};

/**
 * The path of a tool call through the gateway: the interceptor adds the token of the signed-in
 * user, the gateway invokes the Lambda with the arguments and the tool name in the client
 * context, and the Lambda reads through the (fake) services with that token.
 */
async function callAsUser(
  user: string,
  tool: string,
  args: Record<string, unknown>,
  api = fakeApi(gardens),
) {
  const intercepted = interceptRequest({
    mcp: {
      gatewayRequest: {
        headers: { Authorization: `Bearer ${tokenFor(user)}` },
        body: { method: 'tools/call', params: { name: `garden___${tool}`, arguments: args } },
      },
    },
  });
  const body = intercepted.mcp.transformedGatewayRequest.body as {
    params: { arguments: Record<string, unknown> };
  };
  const handler = createToolHandler({
    apiBaseUrl: 'https://hochbeet.example',
    logger: silent,
    reader: (token) => createApiReader('https://hochbeet.example', token, api.fetch),
  });
  const result = await handler(body.params.arguments, {
    clientContext: { custom: { bedrockAgentCoreToolName: `garden___${tool}` } } as never,
  });
  return { result, api };
}

describe('tools through the gateway path', () => {
  it('lists only the beds of the signed-in user', async () => {
    const { result } = await callAsUser('user-a', 'list_beds', {});
    expect(ListBedsToolOutputSchema.parse(result)).toEqual({
      beds: [{ id: BED_A, name: 'Hochbeet Süd', widthCm: 120, depthCm: 80 }],
    });
  });

  it('never reads the bed of another user, even with that user’s token in the arguments', async () => {
    const { result, api } = await callAsUser('user-a', 'get_bed', {
      bedId: BED_B,
      [TOKEN_ARGUMENT]: tokenFor('user-b'),
    });
    expect(result).toEqual({ error: 'Das Beet gibt es nicht.' });
    expect(new Set(api.calls.map((c) => c.sub))).toEqual(new Set(['user-a']));

    const own = await callAsUser('user-b', 'get_bed', { bedId: BED_B });
    expect(GetBedToolOutputSchema.parse(own.result).bed.name).toBe('Geheimbeet');
  });

  it('reads a bed with plant names, periods and the occupied areas', async () => {
    const { result } = await callAsUser('user-a', 'get_bed', { bedId: BED_A });
    expect(GetBedToolOutputSchema.parse(result)).toEqual({
      bed: { id: BED_A, name: 'Hochbeet Süd', widthCm: 120, depthCm: 80, mainRowDirection: 'H' },
      plantings: [
        {
          id: '01J9ZQ3W8D6V2K5M7N8P9R0T01',
          plant: 'Tomate',
          kind: 'SINGLE',
          x: 30,
          y: 40,
          from: '2026-05-04',
          until: '2026-08-31',
          // A tomato occupies a circle of 30 cm radius (half its 60 cm spacing in the row).
          area: { x0: 0, y0: 10, x1: 60, y1: 70 },
        },
        expect.objectContaining({ id: '01J9ZQ3W8D6V2K5M7N8P9R0T02', x: 45 }),
      ],
    });
  });

  it('evaluates a bed with the rule engine and names the plants', async () => {
    const { result } = await callAsUser('user-a', 'evaluate_bed', {
      bedId: BED_A,
      week: '2026-06-10',
    });
    const { findings } = EvaluateBedToolOutputSchema.parse(result);
    expect(findings).toContainEqual(
      expect.objectContaining({ severity: 'WARNING', plants: ['Tomate', 'Tomate'] }),
    );
    expect(findings[0]?.message).toMatch(/Tomate/);

    const winter = await callAsUser('user-a', 'evaluate_bed', {
      bedId: BED_A,
      week: '2026-12-07',
    });
    expect(winter.result).toEqual({ findings: [], unknownCandidates: [] });
  });

  it('uses the user’s last frost for the frost hint, like the app', async () => {
    // The tomatoes start on Monday 4 May 2026: before 15 May, after 20 April.
    const frost = async (settings?: { lastFrost: string }) => {
      const api = fakeApi({
        'user-a': { ...gardens['user-a'], ...(settings ? { settings } : {}) },
      });
      const { result } = await callAsUser('user-a', 'evaluate_bed', { bedId: BED_A }, api);
      expect(api.calls).toContainEqual({ path: '/api/garden/settings', sub: 'user-a' });
      return EvaluateBedToolOutputSchema.parse(result)
        .findings.filter((f) => f.message.includes('frostempfindlich'))
        .map((f) => f.message);
    };
    expect(await frost()).toEqual([
      'Tomate ist frostempfindlich und sollte erst nach dem 15. Mai ins Beet.',
      'Tomate ist frostempfindlich und sollte erst nach dem 15. Mai ins Beet.',
    ]);
    expect(await frost({ lastFrost: '04-20' })).toEqual([]);
  });

  it('checks planned plantings together with the bed and marks them', async () => {
    const { result } = await callAsUser('user-a', 'evaluate_bed', {
      bedId: BED_A,
      week: '2026-06-10',
      candidates: [
        // Right next to the tomatoes: too close.
        { plantId: plantId('Tomate'), kind: 'SINGLE', x: 35, y: 55, startDate: '2026-05-04' },
        {
          plantId: '01J9ZQ3W8D6V2K5M7N8P9R0Z99',
          kind: 'SINGLE',
          x: 100,
          y: 40,
          startDate: '2026-05-04',
        },
      ],
    });
    const output = EvaluateBedToolOutputSchema.parse(result);
    expect(output.unknownCandidates).toEqual([1]);
    expect(output.findings).toContainEqual(
      expect.objectContaining({ severity: 'WARNING', candidates: [0] }),
    );
    // Findings of the bed alone carry no candidate.
    expect(output.findings.some((f) => f.candidates.length === 0)).toBe(true);
  });

  it('finds plants with neighbours by name', async () => {
    const { result } = await callAsUser('user-a', 'find_plants', { query: 'tomat' });
    const { plants, more } = FindPlantsToolOutputSchema.parse(result);
    expect(plants.map((p) => p.name)).toEqual(['Tomate']);
    expect(plants[0]?.goodNeighbors).toContain('Blumenkohl');
    expect(plants[0]?.own).toBe(false);
    expect(more).toBe(0);

    const all = FindPlantsToolOutputSchema.parse(
      (await callAsUser('user-a', 'find_plants', {})).result,
    );
    expect(all.plants).toHaveLength(MAX_PLANTS);
    expect(all.more).toBe(catalog.length - MAX_PLANTS);
  });

  it('finds the raising details of a plant with readable windows', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-07T10:00:00'));
    try {
      const { result } = await callAsUser('user-a', 'find_plants', { query: 'paprika' });
      const [paprika] = FindPlantsToolOutputSchema.parse(result).plants;
      expect(paprika).toMatchObject({
        name: 'Paprika',
        frostSensitive: true,
        sowing: {
          method: 'PRESOW',
          presow: 'KW 11–16 (Anfang März bis Mitte April)',
          propagationWeeks: '7–9',
        },
      });
      expect(paprika?.sowing).not.toHaveProperty('directSow');

      const radish = FindPlantsToolOutputSchema.parse(
        (await callAsUser('user-a', 'find_plants', { query: 'radieschen' })).result,
      ).plants[0];
      expect(radish).toMatchObject({ frostSensitive: false, sowing: { method: 'DIRECT' } });
      expect(radish?.sowing?.directSow).toBe('KW 7–33 (Anfang Februar bis Mitte August)');
    } finally {
      vi.useRealTimers();
    }
  });

  it('lists the sowing batches with stock, planned and free seedlings and the last frost', async () => {
    const { result, api } = await callAsUser('user-a', 'list_sowings', {});
    expect(ListSowingsToolOutputSchema.parse(result)).toEqual({
      lastFrost: '05-15',
      // Current batches by sowing week, then the finished ones, newest first.
      sowings: [
        {
          plant: 'Paprika',
          sowWeek: '2026-03-02',
          stage: 'PLANNED',
          stock: 6,
          planned: 0,
          free: 6,
        },
        {
          plant: 'Kopfsalat',
          sowWeek: '2026-03-16',
          stage: 'PRICKED',
          // Seedlings alive; one single plant and a row of three are planned.
          stock: 18,
          planned: 4,
          free: 14,
          plannedTransplantWeek: '2026-04-20',
          location: 'Fensterbank',
        },
        { plant: 'Tomate', sowWeek: '2026-03-09', stage: 'DONE', stock: 0, planned: 0, free: 0 },
        { plant: 'Tomate', sowWeek: '2025-03-03', stage: 'DONE', stock: 0, planned: 0, free: 0 },
      ],
      more: 0,
    });
    expect(api.calls.map((c) => c.path).sort()).toEqual([
      '/api/catalog/plants',
      '/api/garden/settings',
      '/api/garden/sowings',
    ]);

    const salad = await callAsUser('user-a', 'list_sowings', { query: 'salat' });
    expect(ListSowingsToolOutputSchema.parse(salad.result).sowings.map((s) => s.plant)).toEqual([
      'Kopfsalat',
    ]);
  });

  it('reads only the batches of the signed-in user, with their last frost', async () => {
    const api = fakeApi({
      ...gardens,
      'user-b': { ...gardens['user-b'], settings: { lastFrost: '04-20' } },
    });
    const { result } = await callAsUser(
      'user-b',
      'list_sowings',
      { userId: 'user-a', [TOKEN_ARGUMENT]: tokenFor('user-a') },
      api,
    );
    const output = ListSowingsToolOutputSchema.parse(result);
    expect(output.lastFrost).toBe('04-20');
    expect(output.sowings.map((s) => s.plant)).toEqual(['Lauch']);
    expect(new Set(api.calls.map((c) => c.sub))).toEqual(new Set(['user-b']));
  });

  it('keeps the list short and counts nothing for unknown plants', async () => {
    const many = Array.from({ length: MAX_SOWINGS + 3 }, (_, i) =>
      sowing(`01J9ZQ3W8D6V2K5M7N8P9R0X${String(i).padStart(2, '0')}`, 'Möhre'),
    );
    const unknown = sowing('01J9ZQ3W8D6V2K5M7N8P9R0W06', 'Tomate', { sowDate: '2026-01-05' });
    unknown.sowing.plantId = '01J9ZQ3W8D6V2K5M7N8P9R0Z99';
    unknown.plantings = [
      { id: '01J9ZQ3W8D6V2K5M7N8P9R0T06', bedId: BED_A, startDate: '2026-05-04', kind: 'SINGLE' },
    ];
    const api = fakeApi({ 'user-a': { ...gardens['user-a'], sowings: [...many, unknown] } });
    const output = ListSowingsToolOutputSchema.parse(
      (await callAsUser('user-a', 'list_sowings', {}, api)).result,
    );
    expect(output.sowings).toHaveLength(MAX_SOWINGS);
    expect(output.more).toBe(4);
    // Sown first, so listed first; without its plant the row lengths cannot be counted.
    expect(output.sowings[0]).toEqual({
      plant: 'Unbekannte Sorte',
      sowWeek: '2026-01-05',
      stage: 'SOWN',
      stock: 12,
    });
  });

  it('answers wrong input and unreachable services with a German message', async () => {
    expect((await callAsUser('user-a', 'get_bed', { bedId: '../admin' })).result).toEqual({
      error: 'Bitte gib eine gültige Beet-ID an.',
    });
    const broken = {
      calls: [],
      fetch: () => Promise.resolve(new Response('boom', { status: 502 })),
    };
    expect((await callAsUser('user-a', 'list_beds', {}, broken)).result).toEqual({
      error: 'Die Gartendaten sind gerade nicht erreichbar.',
    });
    expect((await callAsUser('user-a', 'list_sowings', {}, broken)).result).toEqual({
      error: 'Die Gartendaten sind gerade nicht erreichbar.',
    });
    expect((await callAsUser('user-a', 'list_sowings', { query: 'x'.repeat(51) })).result).toEqual({
      error: 'Bitte gib einen kürzeren Suchbegriff an.',
    });
  });
});

describe('tool handler', () => {
  const handler = createToolHandler({
    apiBaseUrl: 'https://hochbeet.example',
    logger: silent,
    reader: () => {
      throw new Error('must not read');
    },
  });

  it('refuses calls without token and unknown tools', async () => {
    const context = { clientContext: { custom: { bedrockAgentCoreToolName: 'x___list_beds' } } };
    expect(await handler({}, context as never)).toEqual({ error: 'Bitte melde dich an.' });
    expect(await handler({}, { clientContext: undefined })).toEqual({
      error: 'Dieses Werkzeug gibt es nicht.',
    });
  });

  it('takes the tool name from the client context and the token from the interceptor', () => {
    const token = tokenFor('user-a');
    const context = {
      clientContext: {
        custom: {
          bedrockAgentCoreToolName: 'garden___get_bed',
          bedrockAgentCorePropagatedHeaders: { authorization: `Bearer ${tokenFor('user-c')}` },
        },
      },
    } as never;
    expect(toolNameOf(context)).toBe('get_bed');
    expect(tokenOf({ [TOKEN_ARGUMENT]: token }, context)).toBe(token);
    // Without the argument, the header the gateway propagated from the interceptor.
    expect(tokenOf({}, context)).toBe(tokenFor('user-c'));
    expect(tokenOf({ [TOKEN_ARGUMENT]: 'not-a-jwt' }, { clientContext: undefined })).toBe(
      undefined,
    );
  });
});

describe('tool definitions', () => {
  it('declares German descriptions and input schemas for every tool', () => {
    const schemas = toolInputJsonSchemas();
    expect(Object.keys(schemas).sort()).toEqual(
      ['evaluate_bed', 'find_plants', 'get_bed', 'list_beds', 'list_sowings'].sort(),
    );
    expect(schemas.get_bed).toMatchObject({
      type: 'object',
      required: ['bedId'],
      properties: { bedId: { type: 'string' } },
    });
    for (const { description } of Object.values(TOOL_DEFINITIONS)) {
      expect(description.length).toBeLessThan(200);
    }
    // The token is never part of what the model sees.
    expect(JSON.stringify(schemas)).not.toContain(TOKEN_ARGUMENT);
  });

  it('runs every declared tool', async () => {
    const reader = createApiReader(
      'https://hochbeet.example',
      tokenFor('user-a'),
      fakeApi(gardens).fetch,
    );
    for (const name of Object.keys(TOOL_DEFINITIONS) as (keyof typeof TOOL_DEFINITIONS)[]) {
      const result = await runTool(name, { bedId: BED_A }, reader);
      expect(result).not.toHaveProperty('error');
    }
  });
});
