import { createContext, useContext } from 'react';
import type { AuthAdapter, AuthUser } from './types';

/**
 * Current user for the router's `beforeLoad` checks. Updated synchronously on sign-in/out,
 * so a navigation right after sign-in already sees the new user.
 */
export class AuthStore {
  user: AuthUser | null = null;

  set(user: AuthUser | null) {
    this.user = user;
  }
}

export interface AuthContextValue {
  store: AuthStore;
  user: AuthUser | null;
  adapter: AuthAdapter;
  /** Re-reads the current user, e.g. after sign-in. */
  refresh: () => Promise<AuthUser | null>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
