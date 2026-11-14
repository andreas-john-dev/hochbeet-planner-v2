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
  garden: {
    title: 'Garden',
    description:
      'Your last frost date applies every year. Frost-sensitive plants only go outside after it, for example in the sowing calendar.',
    lastFrost: 'Last frost',
    day: 'Day',
    dayOption: '{{day}}',
    month: 'Month',
    saved: 'Saved: last frost on {{date}}.',
    reset: 'Reset to {{date}}',
  },
  assistant: {
    title: 'Bed assistant',
    description_one:
      'The assistant remembers preferences from your conversations, such as what you dislike, where you garden or how sunny your bed is. The conversations themselves are kept for {{count}} day.',
    description_other:
      'The assistant remembers preferences from your conversations, such as what you dislike, where you garden or how sunny your bed is. The conversations themselves are kept for {{count}} days.',
    memories: 'Remembered preferences',
    loading: 'Loading preferences',
    forgotten: 'The assistant has forgotten everything.',
    empty: 'No preferences remembered yet.',
    forget: 'Delete everything',
    confirmTitle: 'Delete everything the assistant knows?',
    confirmText:
      'This deletes all remembered preferences and the stored conversations. This cannot be undone.',
  },
};
