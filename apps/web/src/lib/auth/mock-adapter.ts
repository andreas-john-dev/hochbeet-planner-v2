import { AuthFailure } from './errors';
import { ADMIN_GROUP, type AuthAdapter, type AuthUser } from './types';

/** Code that confirms sign-ups and password resets in the mock. */
export const MOCK_CONFIRMATION_CODE = '123456';

interface MockAccount {
  userId: string;
  password: string;
  confirmed: boolean;
  groups: string[];
}

interface MockState {
  accounts: Record<string, MockAccount>;
  session: string | null;
}

/** Users that exist in every fresh mock (dev server and Playwright). */
export const MOCK_USERS = {
  user: { email: 'test@example.com', password: 'Gemuese1!' },
  admin: { email: 'admin@example.com', password: 'Gemuese1!' },
} as const;

export const MOCK_STORAGE_KEY = 'hochbeet-mock-auth';

function initialState(): MockState {
  return {
    accounts: {
      [MOCK_USERS.user.email]: {
        userId: 'mock-user',
        password: MOCK_USERS.user.password,
        confirmed: true,
        groups: [],
      },
      [MOCK_USERS.admin.email]: {
        userId: 'mock-admin',
        password: MOCK_USERS.admin.password,
        confirmed: true,
        groups: [ADMIN_GROUP],
      },
    },
    session: null,
  };
}

/**
 * Local stand-in for Cognito, persisted in localStorage so reloads keep the session.
 * Never used in prod: only when config.json says `authMode: "mock"`.
 */
export function createMockAuthAdapter(storage: Storage = localStorage): AuthAdapter {
  const load = (): MockState => {
    const raw = storage.getItem(MOCK_STORAGE_KEY);
    // Tests may store only `{ session }` to start signed in; accounts then fall back to the seed.
    const stored = raw ? (JSON.parse(raw) as Partial<MockState>) : {};
    return { ...initialState(), ...stored };
  };
  const save = (state: MockState) => {
    storage.setItem(MOCK_STORAGE_KEY, JSON.stringify(state));
  };
  const key = (email: string) => email.trim().toLowerCase();
  const toUser = (email: string, account: MockAccount): AuthUser => ({
    userId: account.userId,
    email,
    groups: account.groups,
  });

  return {
    getCurrentUser() {
      const state = load();
      const account = state.session ? state.accounts[state.session] : undefined;
      return Promise.resolve(state.session && account ? toUser(state.session, account) : null);
    },
    signIn(email, password) {
      const state = load();
      const account = state.accounts[key(email)];
      if (account?.password !== password) {
        return Promise.reject(new AuthFailure('NotAuthorizedException'));
      }
      if (!account.confirmed) return Promise.resolve('CONFIRM_SIGN_UP');
      save({ ...state, session: key(email) });
      return Promise.resolve('DONE');
    },
    signUp(email, password) {
      const state = load();
      if (state.accounts[key(email)]) {
        return Promise.reject(new AuthFailure('UsernameExistsException'));
      }
      state.accounts[key(email)] = {
        userId: `mock-${String(Object.keys(state.accounts).length + 1)}`,
        password,
        confirmed: false,
        groups: [],
      };
      save(state);
      return Promise.resolve();
    },
    confirmSignUp(email, code) {
      const state = load();
      const account = state.accounts[key(email)];
      if (!account) return Promise.reject(new AuthFailure('UserNotFoundException'));
      if (code !== MOCK_CONFIRMATION_CODE) {
        return Promise.reject(new AuthFailure('CodeMismatchException'));
      }
      account.confirmed = true;
      save(state);
      return Promise.resolve();
    },
    resendSignUpCode: () => Promise.resolve(),
    resetPassword: () => Promise.resolve(),
    confirmResetPassword(email, code, newPassword) {
      const state = load();
      const account = state.accounts[key(email)];
      if (!account || code !== MOCK_CONFIRMATION_CODE) {
        return Promise.reject(new AuthFailure('CodeMismatchException'));
      }
      account.password = newPassword;
      save(state);
      return Promise.resolve();
    },
    signOut() {
      save({ ...load(), session: null });
      return Promise.resolve();
    },
    getIdToken() {
      const { session } = load();
      return Promise.resolve(session ? `mock-id-token.${session}` : null);
    },
  };
}
