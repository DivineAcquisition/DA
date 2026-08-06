import { randomBytes } from 'crypto';

/** Cryptographically random token, at least 32 characters, never sequential. */
export function createToken(bytes = 24): string {
  return randomBytes(bytes).toString('base64url');
}

export const NEUTRAL_UNAVAILABLE_MESSAGE =
  'This link is no longer available.';

/** Unresolved variables render as a visible gap — never empty, never raw placeholder. */
export const UNRESOLVED_GAP = '⸺';

const BUILTIN_VARIABLES = ['recipient_name', 'business_name', 'email', 'date'] as const;

export function resolveVariables(
  variables: string[],
  values: Record<string, string | null | undefined>,
): Record<string, string> {
  const resolved: Record<string, string> = {};
  const keys = variables.length > 0 ? variables : [...BUILTIN_VARIABLES];
  for (const key of keys) {
    const raw = values[key];
    if (raw == null || String(raw).trim() === '') {
      resolved[key] = UNRESOLVED_GAP;
    } else {
      resolved[key] = String(raw);
    }
  }
  return resolved;
}

export function applyVariables(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    if (key in values) return values[key];
    return UNRESOLVED_GAP;
  });
}

export function recipientVariableValues(recipient: {
  full_name: string;
  email: string;
  business_name: string | null;
}): Record<string, string> {
  return {
    recipient_name: recipient.full_name,
    business_name: recipient.business_name ?? '',
    email: recipient.email,
    date: new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
  };
}
