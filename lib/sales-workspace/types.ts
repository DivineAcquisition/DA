/** What so_workspace() returns for the signed-in operator. */
export type WorkspacePlacement = {
  id: string;
  client_name: string | null;
  manager_name: string | null;
  placement_type: 'client_placed' | 'da_internal';
  time_zone: string;
  working_days: number[];
  shift_start: string;
  shift_end: string;
  eod_deadline: string;
  paused_at: string | null;
};

export type NoAccessReason = 'not_an_operator' | 'deactivated' | 'placement_ended' | 'lockdown';

export type CertificationNotice = {
  phase: 'current' | 'warning' | 'grace';
  recertify_on: string | null;
  days_left: number | null;
};

export type WorkspaceState =
  | {
      state: 'not_certified';
      operator_name: string;
      certification_level: number | null;
      grace_ended?: boolean;
      recertify_on?: string | null;
    }
  | {
      state: 'awaiting_placement';
      operator_name: string;
      certification_level: number;
      pending: boolean;
      certification?: CertificationNotice;
    }
  | {
      state: 'active';
      operator_name: string;
      certification_level: number;
      placement: WorkspacePlacement;
      certification?: CertificationNotice;
    }
  | {
      state: 'paused';
      operator_name: string;
      certification_level: number;
      placement: WorkspacePlacement;
      certification?: CertificationNotice;
    }
  | { state: 'no_access'; reason: NoAccessReason; operator_name?: string; certification?: CertificationNotice };

export const PLACEMENT_TYPES = [
  { value: 'client_placed', label: 'Client-placed' },
  { value: 'da_internal', label: 'DA internal' },
] as const;

export const ACTIVITY_CATEGORIES = [
  { value: 'outbound_calling', label: 'Outbound calling' },
  { value: 'follow_up', label: 'Text and email follow-up' },
  { value: 'reactivation', label: 'Database reactivation' },
] as const;

export const METRIC_CATEGORIES = [
  { value: 'outbound', label: 'Outbound' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'reactivation', label: 'Reactivation' },
  { value: 'results', label: 'Results' },
  { value: 'timing', label: 'Timing' },
] as const;

export const METRIC_SOURCES = [
  { value: 'operator', label: 'Operator-logged' },
  { value: 'ghl', label: 'GHL only' },
  { value: 'both', label: 'Operator, verified against GHL' },
] as const;

export const METRIC_UNITS = ['count', 'minutes', 'percent', 'seconds'] as const;

/** Placement status as the workspace names it. 'draft' is Pending. */
export type WorkspaceStatus = 'pending' | 'active' | 'paused' | 'ended';
