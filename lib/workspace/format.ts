import type { AgreementStatus, RecipientStatus, RecipientType } from './types';

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function recipientTypeLabel(type: RecipientType): string {
  return type === 'client' ? 'Client' : 'Operator';
}

export function statusLabel(status: RecipientStatus | AgreementStatus | 'active_link' | 'revoked' | 'expired'): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'inactive':
      return 'Inactive';
    case 'sent':
      return 'Sent';
    case 'viewed':
      return 'Viewed';
    case 'completed':
      return 'Completed';
    case 'declined':
      return 'Declined';
    case 'expired':
      return 'Expired';
    case 'active_link':
      return 'Active';
    case 'revoked':
      return 'Revoked';
    default:
      return status;
  }
}

export function linkStatus(row: {
  revoked: boolean;
  expires_at: string | null;
}): 'active_link' | 'revoked' | 'expired' {
  if (row.revoked) return 'revoked';
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) return 'expired';
  return 'active_link';
}

export function maskSecret(value: string): string {
  if (!value) return '';
  if (value.length <= 8) return '••••••••';
  return `${value.slice(0, 4)}${'•'.repeat(Math.min(24, value.length - 8))}${value.slice(-4)}`;
}
