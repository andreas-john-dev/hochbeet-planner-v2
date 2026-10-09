import { describe, expect, it } from 'vitest';
import {
  ApprovePublicationRequestSchema,
  BedWithPlantingsResponseSchema,
  ErrorResponseSchema,
  ImportCatalogRequestSchema,
  ImportGardenRequestSchema,
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

  it('imports beds with their plantings', () => {
    const body = { importId, beds: [bed], plantings: [singlePlanting, rowPlanting] };
    expect(ImportGardenRequestSchema.parse(body)).toEqual(body);
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

describe('error responses', () => {
  it('carry a German message and optional field issues', () => {
    const body = { message: 'Ungültige Eingabe.', issues: [{ path: 'x', message: 'Zu groß.' }] };
    expect(ErrorResponseSchema.parse(body)).toEqual(body);
  });
});
