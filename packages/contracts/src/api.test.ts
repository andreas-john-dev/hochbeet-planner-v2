import { describe, expect, it } from 'vitest';
import {
  ApprovePublicationRequestSchema,
  BedWithPlantingsResponseSchema,
  ErrorResponseSchema,
  RejectPublicationRequestSchema,
  SaveBedRequestSchema,
  SavePlantingRequestSchema,
} from './index';
import { bed, rowPlanting, singlePlanting } from './fixtures.test-utils';

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

describe('error responses', () => {
  it('carry a German message and optional field issues', () => {
    const body = { message: 'Ungültige Eingabe.', issues: [{ path: 'x', message: 'Zu groß.' }] };
    expect(ErrorResponseSchema.parse(body)).toEqual(body);
  });
});
