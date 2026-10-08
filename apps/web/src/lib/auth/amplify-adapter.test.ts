import { Amplify } from 'aws-amplify';
import * as amplifyAuth from 'aws-amplify/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAmplifyAuthAdapter } from './amplify-adapter';

vi.mock('aws-amplify', () => ({ Amplify: { configure: vi.fn() } }));
vi.mock('aws-amplify/auth');

const config = {
  region: 'eu-central-1',
  userPoolId: 'eu-central-1_pool',
  userPoolClientId: 'client',
  authMode: 'cognito' as const,
  apiMode: 'live' as const,
};

function cognitoError(name: string) {
  const error = new Error(name);
  error.name = name;
  return error;
}

describe('Amplify auth adapter', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('configures Amplify with the user pool from config.json', () => {
    createAmplifyAuthAdapter(config);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- asserting on a mock
    expect(Amplify.configure).toHaveBeenCalledWith({
      Auth: {
        Cognito: expect.objectContaining({
          userPoolId: 'eu-central-1_pool',
          userPoolClientId: 'client',
        }) as unknown,
      },
    });
  });

  it('reads email and groups from the ID token', async () => {
    vi.mocked(amplifyAuth.getCurrentUser).mockResolvedValue({ userId: 'sub-1', username: 'x' });
    vi.mocked(amplifyAuth.fetchAuthSession).mockResolvedValue({
      tokens: {
        accessToken: { payload: {} },
        idToken: { payload: { email: 'a@example.com', 'cognito:groups': ['admins'] } },
      },
    });
    await expect(createAmplifyAuthAdapter(config).getCurrentUser()).resolves.toEqual({
      userId: 'sub-1',
      email: 'a@example.com',
      groups: ['admins'],
    });
  });

  it('returns no user when nobody is signed in', async () => {
    vi.mocked(amplifyAuth.getCurrentUser).mockRejectedValue(
      cognitoError('UserUnAuthenticatedException'),
    );
    await expect(createAmplifyAuthAdapter(config).getCurrentUser()).resolves.toBeNull();
  });

  it('signs in with email as username and reports a pending confirmation', async () => {
    vi.mocked(amplifyAuth.signIn).mockResolvedValue({
      isSignedIn: false,
      nextStep: { signInStep: 'CONFIRM_SIGN_UP' },
    });
    await expect(createAmplifyAuthAdapter(config).signIn('a@example.com', 'pw')).resolves.toBe(
      'CONFIRM_SIGN_UP',
    );
    expect(amplifyAuth.signIn).toHaveBeenCalledWith({ username: 'a@example.com', password: 'pw' });
  });

  it('wraps Cognito errors with their exception name', async () => {
    vi.mocked(amplifyAuth.confirmSignUp).mockRejectedValue(cognitoError('CodeMismatchException'));
    await expect(
      createAmplifyAuthAdapter(config).confirmSignUp('a@example.com', '1'),
    ).rejects.toMatchObject({ code: 'CodeMismatchException' });
  });
});
