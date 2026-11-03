import { describe, expect, it } from 'vitest';
import {
  invitedSignInError,
  isForgotPasswordPath,
  isResetPasswordPath,
  newPasswordError,
  passwordPageKind,
  passwordResetEmailError,
  recoveryTokenHash,
  resetNextPath,
} from './password';

describe('password reset', () => {
  it('accepts a normal email and refuses a blank one', () => {
    expect(passwordResetEmailError('ada@divineacquisition.io')).toBeNull();
    expect(passwordResetEmailError('not-an-email')).toBe('Enter the email you sign in with.');
  });

  it('requires two matching passwords of at least 12 characters', () => {
    expect(newPasswordError('short', 'short')).toBe('Use at least 12 characters.');
    expect(newPasswordError('long-enough-1', 'long-enough-2')).toBe('The two passwords do not match.');
    expect(invitedSignInError('Invalid login credentials')).toMatch(/already exists/);
    expect(invitedSignInError('Email not confirmed')).toBe('Email not confirmed');
    expect(newPasswordError('long-enough-1', 'long-enough-1')).toBeNull();
  });

  it('recognises forgot and reset screens on every surface', () => {
    expect(passwordPageKind('/workspace/forgot-password')).toBe('forgot');
    expect(passwordPageKind('/academy/reset-password/')).toBe('reset');
    expect(passwordPageKind('/da')).toBeNull();
    expect(isForgotPasswordPath('/calls/forgot-password')).toBe(true);
    expect(isResetPasswordPath('/acct/reset-password')).toBe(true);
  });

  it('reads only a recovery token hash', () => {
    const params = new URLSearchParams('token_hash=abc&type=recovery&next=%2Fworkspace%2Freset-password');
    expect(recoveryTokenHash(params)).toBe('abc');
    expect(recoveryTokenHash(new URLSearchParams('token_hash=abc&type=signup'))).toBeNull();
    expect(recoveryTokenHash(new URLSearchParams('type=recovery'))).toBeNull();
  });

  it('only continues a recovery link to a reset screen', () => {
    expect(resetNextPath('/da/reset-password', '/da/reset-password')).toBe('/da/reset-password');
    expect(resetNextPath('https://evil.test/da/reset-password', '/da/reset-password')).toBe('/da/reset-password');
    expect(resetNextPath('//evil.test', '/workspace/reset-password')).toBe('/workspace/reset-password');
    expect(resetNextPath('/workspace/operations', '/workspace/reset-password')).toBe('/workspace/reset-password');
  });
});
