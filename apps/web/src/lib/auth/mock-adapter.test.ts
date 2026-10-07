import { beforeEach, describe, expect, it } from 'vitest';
import { createMockAuthAdapter, MOCK_CONFIRMATION_CODE, MOCK_USERS } from './mock-adapter';

describe('mock auth adapter', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('signs the admin in and out', async () => {
    const auth = createMockAuthAdapter();
    expect(await auth.signIn(MOCK_USERS.admin.email, MOCK_USERS.admin.password)).toBe('DONE');
    expect(await auth.getCurrentUser()).toMatchObject({
      email: 'admin@example.com',
      groups: ['admins'],
    });
    expect(await auth.getIdToken()).toBeTruthy();
    await auth.signOut();
    expect(await auth.getCurrentUser()).toBeNull();
    expect(await auth.getIdToken()).toBeNull();
  });

  it('rejects a wrong password', async () => {
    await expect(
      createMockAuthAdapter().signIn(MOCK_USERS.user.email, 'falsch'),
    ).rejects.toMatchObject({ code: 'NotAuthorizedException' });
  });

  it('requires confirming a new account before sign-in', async () => {
    const auth = createMockAuthAdapter();
    await auth.signUp('neu@example.com', 'Tomate12!');
    expect(await auth.signIn('neu@example.com', 'Tomate12!')).toBe('CONFIRM_SIGN_UP');
    await expect(auth.confirmSignUp('neu@example.com', '000000')).rejects.toMatchObject({
      code: 'CodeMismatchException',
    });
    await auth.confirmSignUp('neu@example.com', MOCK_CONFIRMATION_CODE);
    expect(await auth.signIn('neu@example.com', 'Tomate12!')).toBe('DONE');
  });

  it('resets a password with the code', async () => {
    const auth = createMockAuthAdapter();
    await auth.resetPassword(MOCK_USERS.user.email);
    await auth.confirmResetPassword(MOCK_USERS.user.email, MOCK_CONFIRMATION_CODE, 'Kohlrabi1!');
    expect(await auth.signIn(MOCK_USERS.user.email, 'Kohlrabi1!')).toBe('DONE');
  });
});
