import {
  EvaluateBedToolOutputSchema,
  FindPlantsToolOutputSchema,
  GetBedToolOutputSchema,
  ListBedsToolOutputSchema,
} from '@hochbeet/contracts';
import type { Logger } from '@hochbeet/service-kit';
import { describe, expect, it, vi } from 'vitest';
import { createApiReader } from './api';
import { createToolHandler, tokenOf, toolNameOf } from './handler';
import { interceptRequest, TOKEN_ARGUMENT } from './interceptor';
import { bed, catalog, fakeApi, planting, tokenFor } from './test-utils';
import { MAX_PLANTS, runTool, toolInputJsonSchemas, TOOL_DEFINITIONS } from './tools';

const BED_A = '01J9ZQ3W8D6V2K5M7N8P9R0S1A';
const BED_B = '01J9ZQ3W8D6V2K5M7N8P9R0S1B';

const gardens = {
  'user-a': {
    beds: [bed(BED_A, 'Hochbeet Süd')],
    plantings: [
      planting('01J9ZQ3W8D6V2K5M7N8P9R0T01', BED_A, 'Tomate', { x: 30, y: 40 }),
      planting('01J9ZQ3W8D6V2K5M7N8P9R0T02', BED_A, 'Tomate', { x: 45, y: 40 }),
    ],
  },
  'user-b': {
    beds: [bed(BED_B, 'Geheimbeet')],
    plantings: [planting('01J9ZQ3W8D6V2K5M7N8P9R0T03', BED_B, 'Kartoffel', { x: 50, y: 40 })],
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

  it('reads a bed with plant names and periods', async () => {
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
    expect(winter.result).toEqual({ findings: [] });
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
      ['evaluate_bed', 'find_plants', 'get_bed', 'list_beds'].sort(),
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
