import { workingDays } from '@/lib/portal/labels';
import { zoneAbbreviation } from '@/lib/portal/time';
import type { NoAccessReason, WorkspacePlacement, WorkspaceStatus } from './types';

export function firstName(name: string | undefined | null): string {
  return (name ?? '').trim().split(/\s+/)[0] ?? '';
}

function zone(timeZone: string, at: Date): string {
  return zoneAbbreviation(at.toISOString(), timeZone) || timeZone;
}

/** "09:00–17:30 ET, Monday to Friday" */
export function shiftLabel(p: Pick<WorkspacePlacement, 'shift_start' | 'shift_end' | 'time_zone' | 'working_days'>, at = new Date()): string {
  return `${p.shift_start}–${p.shift_end} ${zone(p.time_zone, at)}, ${workingDays(p.working_days)}`;
}

/** "17:30 ET" */
export function deadlineLabel(p: Pick<WorkspacePlacement, 'eod_deadline' | 'time_zone'>, at = new Date()): string {
  return `${p.eod_deadline} ${zone(p.time_zone, at)}`;
}

export const NO_ACCESS_COPY: Record<NoAccessReason, { title: string; body: string }> = {
  placement_ended: {
    title: 'This placement has ended.',
    body: 'Workspace access closed with it. Thank you for the work. DA will contact you about what comes next.',
  },
  deactivated: {
    title: 'Your workspace is closed.',
    body: 'This account is not active. If that is wrong, message your manager or reply to your last email from DA.',
  },
  not_an_operator: {
    title: 'No operator workspace on this account.',
    body: 'The workspace belongs to Sales Operators. Sign in with the account DA invited you on.',
  },
  lockdown: {
    title: 'The workspace is unavailable right now.',
    body: 'DA has paused access across the system. It reopens when the lockdown is released.',
  },
};

/** 9999-12-31 is the coverage date stored when a placement has no end date. */
export function isOpenEnd(value: string | null | undefined): boolean {
  return !value || value >= '9999-01-01';
}

export function statusFromDb(status: string): WorkspaceStatus {
  if (status === 'draft') return 'pending';
  if (status === 'renewed') return 'ended';
  return status as WorkspaceStatus;
}

export const STATUS_LABEL: Record<WorkspaceStatus, string> = {
  pending: 'Pending',
  active: 'Active',
  paused: 'Paused',
  ended: 'Ended',
};

/** Which status changes an admin can make from each status. Mirrors so_set_placement_status(). */
export const NEXT_STATUSES: Record<WorkspaceStatus, WorkspaceStatus[]> = {
  pending: ['active', 'ended'],
  active: ['paused', 'ended'],
  paused: ['active', 'ended'],
  ended: [],
};
