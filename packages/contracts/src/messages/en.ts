import type { ImportKind, Messages, Unit } from './types';

const WHOLE: Record<Unit, string> = {
  weeks: 'Enter whole weeks.',
  days: 'Enter whole days.',
  celsius: 'Enter whole degrees.',
  pieces: 'Enter a whole number.',
};

const range = (min: number, max: number, unit: Unit) => {
  const span = `${String(min)} to ${String(max)}`;
  if (unit === 'weeks') return `Enter ${span} weeks.`;
  if (unit === 'days') return `Enter ${span} days.`;
  if (unit === 'celsius') return `Enter ${span} °C.`;
  return `Enter a number from ${span}.`;
};

const IMPORTS: Record<ImportKind, string> = {
  beds: 'beds',
  plantings: 'plantings',
  sowings: 'batches',
  plants: 'own plants',
  overrides: 'adjustments',
};

/** British English, like the app. */
export const en: Messages = {
  validation: {
    nameRequired: 'Please enter a name.',
    gridMultiple: ({ step }) => `Must be a multiple of ${String(step)} cm.`,
    minCm: ({ min }) => `At least ${String(min)} cm.`,
    ulid: 'Not a valid ULID.',
    dateFormat: 'Expected a date as YYYY-MM-DD.',
    dateInvalid: 'Not a valid date.',
    monday: 'Must be a Monday.',
    weekWhole: 'Enter the week as a whole number.',
    weekRange: 'Enter a week from 1 to 53.',
    dateDuplicate: 'Date entered twice.',
    sowingOnlyTransplant: 'Only planted out plantings come from a batch.',
    endAfterStart: 'The end must be after the start.',
    removedAfterStart: 'Removal cannot be before the start.',
    whole: ({ unit }) => WHOLE[unit],
    range: ({ min, max, unit }) => range(min, max, unit),
    maxChars: ({ max }) => `At most ${String(max)} characters.`,
    transplantAfterSowing: 'Planting out must be after sowing.',
    rangeOrder: 'The “to” value must be at least the “from” value.',
    presowWeeksRequired: 'Please enter the weeks for starting indoors.',
    propagationWeeksRequired: 'Please enter how long it is raised indoors.',
    presowOnly: 'Only when started indoors.',
    directSowWeeksRequired: 'Please enter the weeks for direct sowing.',
    directOnly: 'Only with direct sowing.',
    color: 'Expected a colour as #rrggbb.',
    icon: 'Unknown icon.',
    overrideEmpty: 'No change given.',
    monthDayFormat: 'Enter the date as MM-DD.',
    monthDayEveryYear: 'This day does not exist in every year.',
    importMax: ({ max, kind }) => `At most ${String(max)} ${IMPORTS[kind]} at once.`,
    bedDuplicate: 'Bed included twice.',
    sowingDuplicate: 'Batch included twice.',
    bedMissing: 'This bed is missing from the import.',
    rejectionComment: 'Please give a reason for the rejection.',
    questionRequired: 'Please write a question to the assistant.',
    questionTooLong: ({ max }) =>
      `Your question is too long. Please keep it shorter (at most ${String(max)} characters).`,
    neighborSelf: 'A plant cannot be its own neighbour.',
    neighborUnknown: 'Unknown plant.',
    neighborGlobalOnly: 'Global plants can only refer to global plants.',
  },
  errors: {
    signIn: 'Please sign in.',
    unknownPath: 'This address does not exist.',
    invalidJson: 'The request is not valid JSON.',
    checkInput: 'Please check your entries.',
    server: 'Something went wrong. Please try again later.',
    bedNotFound: 'This bed does not exist.',
    plantingNotFound: 'This planting does not exist.',
    sowingNotFound: 'This batch does not exist.',
    plantNotFound: 'This plant does not exist.',
    adminOnly: 'This area is for admins only.',
    alreadyHandled: 'This request has already been handled.',
    noOpenRequest: 'There is no open request for this plant.',
    alreadyPublished: 'This plant is already published.',
    checkNeighbors: 'Please check the neighbours.',
    guestPublish: 'Sign in to suggest a plant for everyone.',
    storageFull: 'Your browser’s storage is full. Delete old beds and try again.',
    localFailed: 'That did not work. Please try again.',
    catalogUnavailable:
      'The catalogue cannot be reached right now. Check your internet connection and try again.',
  },
};
