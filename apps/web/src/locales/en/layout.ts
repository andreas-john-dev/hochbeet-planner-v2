import type { layout as de } from '../de/layout';

export const layout: typeof de = {
  nav: {
    label: 'Main navigation',
    beds: 'Beds',
    sowings: 'Seedlings',
    catalog: 'Catalogue',
    profile: 'Profile',
    admin: 'Admin',
  },
  guestMode: 'Guest mode',
  signOut: 'Sign out',
  theme: {
    name: 'Colour scheme',
    light: 'Light',
    dark: 'Dark',
    system: 'System',
    current: 'Colour scheme: {{theme}}',
    switch: 'Colour scheme: {{theme}}. Switch to {{next}}',
  },
  guestBanner: {
    lead: 'You are planning without an account.',
    text: 'Your beds are stored in this browser only. With an account they are backed up and available on all your devices.',
    createAccount: 'Create account',
    signIn: 'Sign in',
    end: 'End guest mode',
    endTitle: 'End guest mode?',
    endDescription:
      'Your beds, plantings and own varieties are stored in this browser only. Keep them for later or delete them now. Deleting cannot be undone.',
    keepData: 'Keep data',
    deleteData: 'Delete data',
  },
  toBeds: 'Go to beds',
  notFound: {
    title: 'Page not found',
    text: 'This address does not exist. Perhaps there is a typo.',
  },
  forbidden: {
    title: 'No access',
    text: 'This area is for admins only. Error 403: you do not have permission for this page.',
  },
};
