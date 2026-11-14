import type { guestImport as de } from '../de/guestImport';

export const guestImport: typeof de = {
  title: 'Import beds from guest mode?',
  found: 'This browser holds {{data}} from guest mode.',
  accountHasBeds: 'Your account already has beds; the ones from this browser are added.',
  accountEmpty: 'Import them into your account so they are backed up and on all your devices.',
  discardHint: 'Discard deletes them from this browser.',
  later: 'Later',
  discard: 'Discard',
  importing: 'Importing …',
  add: 'Add local beds',
  import: 'Import',
  data: {
    beds_one: '{{count}} bed',
    beds_other: '{{count}} beds',
    plantings_one: '{{count}} planting',
    plantings_other: '{{count}} plantings',
    sowings_one: '{{count}} batch of seedlings',
    sowings_other: '{{count}} batches of seedlings',
    ownPlants_one: '{{count}} own plant',
    ownPlants_other: '{{count}} own plants',
    overrides_one: '{{count}} adjustment',
    overrides_other: '{{count}} adjustments',
  },
};
