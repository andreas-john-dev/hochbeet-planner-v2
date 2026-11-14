import type { common as de } from '../de/common';

export const common: typeof de = {
  appName: 'Raised Bed Planner',
  cancel: 'Cancel',
  close: 'Close',
  save: 'Save',
  delete: 'Delete',
  back: 'Back',
  loading: 'Loading …',
  language: {
    label: 'Language',
    de: 'Deutsch',
    en: 'English',
  },
  apiError: {
    unauthorized: 'Your session has expired. Please sign in again.',
    forbidden: 'You do not have permission to do that.',
    notFound: 'This no longer exists. Please reload the page.',
    tooManyRequests: 'Too many requests. Please try again later.',
    server: 'The server is having a problem. Please try again in a moment.',
    offline: 'No connection to the server. Check your internet connection and try again.',
    generic: 'That did not work. Please try again.',
  },
};
