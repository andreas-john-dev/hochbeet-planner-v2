import type { profile as de } from '../de/profile';

export const profile: typeof de = {
  title: 'Profile',
  description: 'Account and settings.',
  account: {
    title: 'Account',
    signedInAs: 'Signed in as',
    admin: 'Admin',
  },
  appearance: {
    title: 'Appearance',
    description: 'Choose light, dark or your device setting.',
  },
  language: {
    title: 'Language',
    description: 'Applies to the app in this browser.',
  },
};
