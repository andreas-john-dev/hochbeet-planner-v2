/** Languages of the messages in schemas and error responses. German is the default. */
export const LOCALES = ['de', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'de';

/** What a whole number or range counts, e.g. "1 bis 26 Wochen". */
export type Unit = 'weeks' | 'days' | 'celsius' | 'pieces';

/** What an import holds too much of. */
export type ImportKind = 'beds' | 'plantings' | 'sowings' | 'plants' | 'overrides';

/**
 * All texts of `packages/contracts` in one language. `validation` are the schemas' own
 * messages (and the services' field checks), `errors` the `message` of error responses.
 * Ids are unique across both parts.
 */
export interface Messages {
  validation: {
    nameRequired: string;
    gridMultiple: (params: { step: number }) => string;
    minCm: (params: { min: number }) => string;
    ulid: string;
    dateFormat: string;
    dateInvalid: string;
    monday: string;
    weekWhole: string;
    weekRange: string;
    dateDuplicate: string;
    sowingOnlyTransplant: string;
    endAfterStart: string;
    removedAfterStart: string;
    whole: (params: { unit: Unit }) => string;
    range: (params: { min: number; max: number; unit: Unit }) => string;
    maxChars: (params: { max: number }) => string;
    transplantAfterSowing: string;
    rangeOrder: string;
    presowWeeksRequired: string;
    propagationWeeksRequired: string;
    presowOnly: string;
    directSowWeeksRequired: string;
    directOnly: string;
    color: string;
    icon: string;
    overrideEmpty: string;
    monthDayFormat: string;
    monthDayEveryYear: string;
    importMax: (params: { max: number; kind: ImportKind }) => string;
    bedDuplicate: string;
    sowingDuplicate: string;
    bedMissing: string;
    rejectionComment: string;
    questionRequired: string;
    questionTooLong: (params: { max: number }) => string;
    neighborSelf: string;
    neighborUnknown: string;
    neighborGlobalOnly: string;
  };
  errors: {
    signIn: string;
    unknownPath: string;
    invalidJson: string;
    checkInput: string;
    server: string;
    bedNotFound: string;
    plantingNotFound: string;
    sowingNotFound: string;
    plantNotFound: string;
    adminOnly: string;
    alreadyHandled: string;
    noOpenRequest: string;
    alreadyPublished: string;
    checkNeighbors: string;
    guestPublish: string;
    storageFull: string;
    localFailed: string;
    catalogUnavailable: string;
  };
}
