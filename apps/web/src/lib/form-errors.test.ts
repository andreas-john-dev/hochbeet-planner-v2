import { zodResolver } from '@hookform/resolvers/zod';
import { BedFieldsSchema } from '@hochbeet/contracts';
import { describe, expect, it } from 'vitest';
import { withContractMessages } from './form-errors';

const schema = BedFieldsSchema.pick({ name: true, widthCm: true });

const messages = async (language: 'de' | 'en') => {
  const resolver = withContractMessages(zodResolver(schema), language);
  const result = await resolver({ name: ' ', widthCm: 3 }, undefined, {
    fields: {},
    shouldUseNativeValidation: false,
  });
  return Object.fromEntries(
    Object.entries(result.errors).map(([field, error]) => [field, error.message]),
  );
};

describe('withContractMessages', () => {
  it('shows the own messages of a contract schema in the language of the app', async () => {
    expect(await messages('de')).toEqual({
      name: 'Bitte einen Namen angeben.',
      widthCm: 'Muss ein Vielfaches von 5 cm sein.',
    });
    expect(await messages('en')).toEqual({
      name: 'Please enter a name.',
      widthCm: 'Must be a multiple of 5 cm.',
    });
  });
});
