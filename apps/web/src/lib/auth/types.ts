export interface AuthUser {
  userId: string;
  email: string;
  groups: string[];
}

export type SignInResult = 'DONE' | 'CONFIRM_SIGN_UP';

/** Everything the app needs from the identity provider. Implemented for Cognito and as a local mock. */
export interface AuthAdapter {
  getCurrentUser(): Promise<AuthUser | null>;
  signIn(email: string, password: string): Promise<SignInResult>;
  signUp(email: string, password: string): Promise<void>;
  confirmSignUp(email: string, code: string): Promise<void>;
  resendSignUpCode(email: string): Promise<void>;
  resetPassword(email: string): Promise<void>;
  confirmResetPassword(email: string, code: string, newPassword: string): Promise<void>;
  signOut(): Promise<void>;
  /** ID token for API calls, refreshed if needed; null when signed out. */
  getIdToken(): Promise<string | null>;
}

export const ADMIN_GROUP = 'admins';

export const isAdmin = (user: AuthUser | null) => !!user?.groups.includes(ADMIN_GROUP);
