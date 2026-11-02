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

/** The one-time recovery token on a link we sent. Other types stay on the code exchange. */
export function recoveryTokenHash(params: { get(name: string): string | null }): string | null {
  const token = params.get('token_hash')?.trim() ?? '';
  if (!token || params.get('type') !== 'recovery') return null;
  return token;
}

/** The page a recovery email may open. Anything else stays on the fallback. */
export function resetNextPath(value: string | null, fallback: string): string {
  if (!value) return fallback;
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\') || value.includes('://')) return fallback;
  const path = barePath(value);
  if (!isResetPasswordPath(path)) return fallback;
  return path;
}
