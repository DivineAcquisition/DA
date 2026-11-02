import type { EmailPurpose } from './policy';

/**
 * Reply-to for operational, alert, and client mail. This is the inbox the app
 * already copies on assessment and agreement mail. DA Admin can change it.
 */
export const DEFAULT_REPLY_TO = 'malik@divineacquisition.io';

export type EmailIdentity = {
  purpose: EmailPurpose;
  displayName: string;
  address: string;
  replyTo: string | null;
};

export const EMAIL_IDENTITY_DEFAULTS: Record<EmailPurpose, EmailIdentity> = {
  security: {
    purpose: 'security',
    displayName: 'Divine Acquisition',
    address: 'noreply@noreply.divineacquisition.io',
    replyTo: null,
  },
  team: {
    purpose: 'team',
    displayName: 'DA Operations',
    address: 'ops@updates.divineacquisition.io',
    replyTo: DEFAULT_REPLY_TO,
  },
  alerts: {
    purpose: 'alerts',
    displayName: 'DA Operations',
    address: 'alerts@updates.divineacquisition.io',
    replyTo: DEFAULT_REPLY_TO,
  },
  client: {
    purpose: 'client',
    displayName: 'Divine Acquisition',
    address: 'reports@updates.divineacquisition.io',
    replyTo: DEFAULT_REPLY_TO,
  },
};

export function formatFrom(identity: EmailIdentity): string {
  const name = identity.displayName.replace(/[<>"]/g, '').trim() || 'Divine Acquisition';
  return `${name} <${identity.address}>`;
}

export function domainForPurpose(purpose: EmailPurpose): string {
  return purpose === 'security' ? 'noreply.divineacquisition.io' : 'updates.divineacquisition.io';
}

export function identityFromRow(row: {
  purpose: string;
  display_name?: string | null;
  displayName?: string | null;
  address?: string | null;
  reply_to?: string | null;
  replyTo?: string | null;
}): EmailIdentity | null {
  const purpose = row.purpose as EmailPurpose;
  const fallback = EMAIL_IDENTITY_DEFAULTS[purpose];
  if (!fallback) return null;
  const address = (row.address ?? fallback.address).trim().toLowerCase();
  const reply = (row.replyTo ?? row.reply_to ?? fallback.replyTo)?.trim().toLowerCase() || null;
  return {
    purpose,
    displayName: (row.displayName ?? row.display_name ?? fallback.displayName).trim() || fallback.displayName,
    address,
    replyTo: purpose === 'security' ? null : reply,
  };
}
