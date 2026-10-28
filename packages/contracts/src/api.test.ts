import { describe, expect, it } from 'vitest';
import {
  ApprovePublicationRequestSchema,
  AssistantEventSchema,
  AssistantForgetResponseSchema,
  AssistantMemoriesResponseSchema,
  AssistantMemoryRequestSchema,
  AssistantRequestSchema,
  EvaluateBedToolInputSchema,
  FindPlantsToolInputSchema,
  GetBedToolInputSchema,
  BedWithPlantingsResponseSchema,
  DEFAULT_GARDEN_SETTINGS,
  ErrorResponseSchema,
  GardenSettingsSchema,
  ImportCatalogRequestSchema,
  ImportGardenRequestSchema,
  ListSowingsResponseSchema,
  RejectPublicationRequestSchema,
  SaveBedRequestSchema,
  SavePlantingRequestSchema,
} from './index';
import { bed, ID, rowPlanting, singlePlanting, tomato } from './fixtures.test-utils';

describe('garden API contracts', () => {
  it('creates beds without id', () => {
    const { id, ...fields } = bed;
    expect(SaveBedRequestSchema.parse(fields)).toEqual(fields);
    expect(SaveBedRequestSchema.parse(bed)).not.toHaveProperty('id');
  });

  it('saves plantings without id and bedId (they come from the path)', () => {
    const { id, bedId, ...fields } = rowPlanting;
    expect(SavePlantingRequestSchema.parse(fields)).toEqual(fields);
    expect(SavePlantingRequestSchema.parse(rowPlanting)).not.toHaveProperty('bedId');
  });

  it('returns a bed with its plantings', () => {
    const body = { bed, plantings: [singlePlanting, rowPlanting] };
    expect(BedWithPlantingsResponseSchema.parse(body)).toEqual(body);
  });

  it('lists batches with their linked plantings in compact form', () => {
    const sowing = {
      id: '01J9ZQ3W8D6V2K5M7N8P9R0SW1',
      plantId: tomato.id,
      sowDate: '2026-03-09',
      sownCount: 12,
      aliveCount: 10,
      stage: 'HARDENING',
    };
    const body = {
      sowings: [
        {
          sowing,
          plantings: [
            { id: ID.planting, bedId: ID.bed, kind: 'SINGLE', startDate: '2026-05-18' },
            { id: ID.basil, bedId: ID.bed, kind: 'ROW', lengthCm: 100, startDate: '2026-05-18' },
          ],
        },
      ],
    };
    expect(ListSowingsResponseSchema.parse(body)).toEqual(body);
    const rowWithoutLength = {
      sowings: [{ sowing, plantings: [{ ...body.sowings[0]?.plantings[1], lengthCm: undefined }] }],
    };
    expect(ListSowingsResponseSchema.safeParse(rowWithoutLength).success).toBe(false);
  });

  it('accepts a last frost day of every year and nothing else', () => {
    expect(GardenSettingsSchema.parse(DEFAULT_GARDEN_SETTINGS)).toEqual({ lastFrost: '05-15' });
    for (const lastFrost of ['01-01', '04-30', '02-28', '12-31']) {
      expect(GardenSettingsSchema.safeParse({ lastFrost }).success).toBe(true);
    }
    const message = (lastFrost: string) =>
      GardenSettingsSchema.safeParse({ lastFrost }).error?.issues[0]?.message;
    expect(message('02-29')).toBe('Diesen Tag gibt es nicht in jedem Jahr.');
    expect(message('04-31')).toBe('Diesen Tag gibt es nicht in jedem Jahr.');
    expect(message('13-01')).toBe('Diesen Tag gibt es nicht in jedem Jahr.');
    expect(message('00-10')).toBe('Diesen Tag gibt es nicht in jedem Jahr.');
    expect(message('5-15')).toBe('Datum als MM-TT angeben.');
    expect(message('2026-05-15')).toBe('Datum als MM-TT angeben.');
  });
});

describe('catalog API contracts', () => {
  it('approves with optional corrections', () => {
    expect(ApprovePublicationRequestSchema.parse({})).toEqual({});
    expect(
      ApprovePublicationRequestSchema.safeParse({ corrections: { family: 'Doldenblütler' } })
        .success,
    ).toBe(true);
  });

  it('requires a reason to reject', () => {
    expect(RejectPublicationRequestSchema.safeParse({ comment: '  ' }).success).toBe(false);
  });
});

describe('import contracts', () => {
  const importId = '01J9ZQ3W8D6V2K5M7N8P9R0MP1';

  it('imports beds with their plantings, batches only from newer app versions', () => {
    const body = { importId, beds: [bed], plantings: [singlePlanting, rowPlanting] };
    expect(ImportGardenRequestSchema.parse(body)).toEqual({ ...body, sowings: [] });
  });

  it('imports batches once each and at most 200', () => {
    const sowing = {
      id: '01J9ZQ3W8D6V2K5M7N8P9R0SW1',
      plantId: tomato.id,
      sowDate: '2026-03-09',
      sownCount: 12,
      aliveCount: 10,
      stage: 'SOWN',
    };
    const body = {
      importId,
      beds: [bed],
      plantings: [{ ...singlePlanting, sowingId: sowing.id }],
      sowings: [sowing],
    };
    expect(ImportGardenRequestSchema.parse(body)).toEqual(body);
    const twice = ImportGardenRequestSchema.safeParse({ ...body, sowings: [sowing, sowing] });
    expect(twice.error?.issues.map((i) => i.message)).toEqual(['Anzucht doppelt.']);
    const many = ImportGardenRequestSchema.safeParse({
      ...body,
      sowings: Array.from({ length: 201 }, () => sowing),
    });
    expect(many.error?.issues[0]?.message).toBe('Höchstens 200 Anzuchten auf einmal.');
  });

  it('refuses plantings of beds outside the import and duplicate beds', () => {
    const result = ImportGardenRequestSchema.safeParse({
      importId,
      beds: [bed, bed],
      plantings: [{ ...singlePlanting, bedId: ID.tomato }],
    });
    expect(result.error?.issues.map((i) => [i.path.join('.'), i.message])).toEqual([
      ['beds', 'Beet doppelt.'],
      ['plantings.0.bedId', 'Dieses Beet fehlt im Import.'],
    ]);
  });

  it('limits the size of an import', () => {
    const beds = Array.from({ length: 51 }, () => bed);
    const result = ImportGardenRequestSchema.safeParse({ importId, beds, plantings: [] });
    expect(result.error?.issues[0]?.message).toBe('Höchstens 50 Beete auf einmal.');
  });

  it('imports own plants, optionally archived, and adjustments', () => {
    const body = {
      importId,
      ownPlants: [{ ...tomato, archived: true }],
      overrides: [{ plantId: tomato.id, fields: { spacingInRowCm: 30 } }],
    };
    expect(ImportCatalogRequestSchema.parse(body)).toEqual(body);
    expect(
      ImportCatalogRequestSchema.safeParse({
        ...body,
        overrides: [{ plantId: tomato.id, fields: {} }],
      }).success,
    ).toBe(false);
  });
});

describe('assistant contracts', () => {
  it('takes a trimmed question with the id of the bed on screen', () => {
    expect(AssistantRequestSchema.parse({ message: '  Was passt zu Tomaten? ' })).toEqual({
      message: 'Was passt zu Tomaten?',
    });
    const withBed = { message: 'Und hier?', bedId: bed.id };
    expect(AssistantRequestSchema.parse(withBed)).toEqual(withBed);
    expect(AssistantRequestSchema.safeParse({ message: 'Hier?', bedId: 'x' }).success).toBe(false);
  });

  it('describes tool inputs for the model and checks ids and dates', () => {
    expect(GetBedToolInputSchema.safeParse({ bedId: bed.id }).success).toBe(true);
    expect(GetBedToolInputSchema.safeParse({ bedId: '../admin' }).success).toBe(false);
    expect(
      EvaluateBedToolInputSchema.safeParse({ bedId: bed.id, week: '2026-13-01' }).success,
    ).toBe(false);
    expect(FindPlantsToolInputSchema.parse({ query: ' Tomate ' })).toEqual({ query: 'Tomate' });
    expect(GetBedToolInputSchema.shape.bedId.description).toMatch(/ID des Beets/);
  });

  it('refuses empty and too long questions in German', () => {
    expect(AssistantRequestSchema.safeParse({ message: '   ' }).error?.issues[0]?.message).toBe(
      'Bitte schreib eine Frage an den Assistenten.',
    );
    expect(
      AssistantRequestSchema.safeParse({ message: 'x'.repeat(2001) }).error?.issues[0]?.message,
    ).toMatch(/höchstens 2000 Zeichen/);
  });

  it('lists or forgets the remembered preferences', () => {
    expect(AssistantMemoryRequestSchema.parse({ memory: 'forget' })).toEqual({ memory: 'forget' });
    expect(AssistantMemoryRequestSchema.safeParse({ memory: 'everything' }).success).toBe(false);
    const list = {
      memories: [{ id: 'mem-1', text: 'Mag keinen Fenchel.', createdAt: '2026-10-07T08:00:00Z' }],
    };
    expect(AssistantMemoriesResponseSchema.parse(list)).toEqual(list);
    expect(AssistantForgetResponseSchema.parse({ memories: 2, events: 5 })).toEqual({
      memories: 2,
      events: 5,
    });
  });

  it('streams text, then done with the questions left, or an error', () => {
    for (const event of [{ text: 'Hallo' }, { done: true, remaining: 3 }, { error: 'Weg' }]) {
      expect(AssistantEventSchema.parse(event)).toEqual(event);
    }
  });
});

describe('error responses', () => {
  it('carry a German message and optional field issues', () => {
    const body = { message: 'Ungültige Eingabe.', issues: [{ path: 'x', message: 'Zu groß.' }] };
    expect(ErrorResponseSchema.parse(body)).toEqual(body);
  });
});
