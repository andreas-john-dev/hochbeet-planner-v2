import { Amplify } from 'aws-amplify';
import * as amplifyAuth from 'aws-amplify/auth';
import type { AppConfig } from '../config';
import { AuthFailure } from './errors';
import type { AuthAdapter } from './types';

/** Runs an Amplify call and turns its errors into AuthFailure with the Cognito exception name. */
async function call<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw new AuthFailure(error instanceof Error ? error.name : 'Unknown');
  }
}

/** Cognito via Amplify: email + password, SRP, no hosted UI. */
export function createAmplifyAuthAdapter(config: AppConfig): AuthAdapter {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: config.userPoolId,
        userPoolClientId: config.userPoolClientId,
        loginWith: { email: true },
        signUpVerificationMethod: 'code',
      },
    },
  });

  return {
    async getCurrentUser() {
      try {
        const { userId } = await amplifyAuth.getCurrentUser();
        const { tokens } = await amplifyAuth.fetchAuthSession();
        const payload = tokens?.idToken?.payload ?? {};
        const groups = payload['cognito:groups'];
        return {
          userId,
          email: typeof payload.email === 'string' ? payload.email : '',
          groups: Array.isArray(groups) ? groups.filter((g) => typeof g === 'string') : [],
        };
      } catch {
        return null; // not signed in
      }
    },
    async signIn(email, password) {
      const { nextStep } = await call(() => amplifyAuth.signIn({ username: email, password }));
      if (nextStep.signInStep === 'DONE') return 'DONE';
      if (nextStep.signInStep === 'CONFIRM_SIGN_UP') return 'CONFIRM_SIGN_UP';
      // MFA or forced password change are not configured for this user pool.
      throw new AuthFailure(`Unsupported:${nextStep.signInStep}`);
    },
    async signUp(email, password) {
      await call(() =>
        amplifyAuth.signUp({
          username: email,
          password,
          options: { userAttributes: { email } },
        }),
      );
    },
    async confirmSignUp(email, code) {
      await call(() => amplifyAuth.confirmSignUp({ username: email, confirmationCode: code }));
    },
    async resendSignUpCode(email) {
      await call(() => amplifyAuth.resendSignUpCode({ username: email }));
    },
    async resetPassword(email) {
      await call(() => amplifyAuth.resetPassword({ username: email }));
    },
    async confirmResetPassword(email, code, newPassword) {
      await call(() =>
        amplifyAuth.confirmResetPassword({ username: email, confirmationCode: code, newPassword }),
      );
    },
    async signOut() {
      await call(() => amplifyAuth.signOut());
    },
    async getIdToken() {
      try {
        const { tokens } = await amplifyAuth.fetchAuthSession();
        return tokens?.idToken?.toString() ?? null;
      } catch {
        return null;
      }
    },
  };
}
