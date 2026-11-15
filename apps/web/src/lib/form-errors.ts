import { localizeMessage } from '@hochbeet/contracts';
import type { FieldValues, Resolver } from 'react-hook-form';
import type { Language } from './language';

/** Replaces every `message` in react-hook-form's nested errors with its text in `language`. */
function localizeErrors(errors: unknown, language: Language): void {
  if (!errors || typeof errors !== 'object') return;
  const record = errors as Record<string, unknown>;
  for (const [key, value] of Object.entries(record)) {
    if (key === 'ref') continue;
    if (key === 'message' && typeof value === 'string') {
      record[key] = localizeMessage(value, language);
    } else {
      localizeErrors(value, language);
    }
  }
}

/**
 * A resolver for a contract schema (e.g. `zodResolver(BedFieldsSchema)`) whose own messages,
 * stored as keys in `packages/contracts`, show as text in `language`.
 */
export function withContractMessages<T extends FieldValues, C, O>(
  resolver: Resolver<T, C, O>,
  language: Language,
): Resolver<T, C, O> {
  return async (values, context, options) => {
    const result = await resolver(values, context, options);
    localizeErrors(result.errors, language);
    return result;
  };
}
