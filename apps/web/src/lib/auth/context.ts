import { createContext, useContext } from 'react';
import type { AuthAdapter, AuthUser } from './types';

/**
 * Current user for the router's `beforeLoad` checks. Updated synchronously on sign-in/out,
 * so a navigation right after sign-in already sees the new user.
 */
export class AuthStore {
  user: AuthUser | null = null;
  /** Using the app without an account; never true while a user is signed in. */
  guest = false;

  set(user: AuthUser | null, guest = false) {
    this.user = user;
    this.guest = !user && guest;
  }
}

export interface AuthContextValue {
  store: AuthStore;
  user: AuthUser | null;
  /** True in guest mode: data lives in this browser, there is no user. */
  guest: boolean;
  adapter: AuthAdapter;
  /** Re-reads the current user, e.g. after sign-in. */
  refresh: () => Promise<AuthUser | null>;
  signOut: () => Promise<void>;
  /** Starts guest mode („Ohne Konto ausprobieren“). */
  startGuest: () => void;
  /** Ends guest mode; the guest's data stays for a later visit unless `deleteData`. */
  endGuest: (options: { deleteData: boolean }) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
