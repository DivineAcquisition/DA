export type PasswordResult = { ok: true } | { ok: false; error: string };

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function passwordResetEmailError(email: string): string | null {
  if (!EMAIL.test(email.trim())) return 'Enter the email you sign in with.';
  return null;
}

export function newPasswordError(password: string, confirm: string): string | null {
  if (password.length < 12) return 'Use at least 12 characters.';
  if (password !== confirm) return 'The two passwords do not match.';
  return null;
}

/** The sign-in that follows a closed signup. No password was saved, so this is not a wrong password. */
export function invitedSignInError(message: string): string {
  if (/invalid login credentials/i.test(message)) {
    return 'An account for this email already exists, and this password does not match it. Use Forgot password on the sign-in page.';
  }
  return message;
}

function barePath(pathname: string): string {
  const path = pathname.split('?')[0]?.replace(/\/+$/, '') || '/';
  return path === '' ? '/' : path;
}

export function isForgotPasswordPath(pathname: string): boolean {
  const path = barePath(pathname);
  return path === '/forgot-password' || path.endsWith('/forgot-password');
}

export function isResetPasswordPath(pathname: string): boolean {
  const path = barePath(pathname);
  return path === '/reset-password' || path.endsWith('/reset-password');
}

export function passwordPageKind(pathname: string): 'forgot' | 'reset' | null {
  if (isForgotPasswordPath(pathname)) return 'forgot';
  if (isResetPasswordPath(pathname)) return 'reset';
  return null;
}

/** The page a recovery email may open. Anything else stays on the fallback. */
export function resetNextPath(value: string | null, fallback: string): string {
  if (!value) return fallback;
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\') || value.includes('://')) return fallback;
  const path = barePath(value);
  if (!isResetPasswordPath(path)) return fallback;
  return path;
}
