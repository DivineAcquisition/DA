import { EMPTY_OFFER, type OfferBrief } from './offer';
import type { SavedMapping } from './mapping';

export type WizardPayload = {
  operator_id: string;
  not_ready_reason: string;
  case_file_id: string;
  template_slug: string;
  placement_type: 'client_placed' | 'da_internal';
  manager_profile_id: string;
  start_date: string;
  time_zone: string;
  working_days: number[];
  shift_start: string;
  shift_end: string;
  eod_deadline: string;
  review_on: string;
  schedule_confirmed: boolean;
  activity_categories: string[];
  tracks_results: boolean;
  work_confirmed: boolean;
  outcomes: Array<{ name: string; definition: string }>;
  offer: OfferBrief;
  offer_confirmed: boolean;
  reporting: {
    recipients: string[];
    extra: string[];
    cc_manager: boolean;
    send_dow: number;
    send_time: string;
    daily: boolean;
    approval: boolean;
    intro: 'activation' | 'date' | 'none';
    intro_on: string;
  };
  reporting_confirmed: boolean;
  ghl: {
    phone: '' | 'assigned' | 'not_assigned' | 'not_needed';
    user_id: string;
    user_pending: boolean;
    mapping: SavedMapping | Record<string, never>;
  };
  ghl_suggestions: { calendars?: string[]; stage?: string | null; tag?: string | null };
  mapping_confirmed: boolean;
  first_day: string[];
  targets_mode: 'empty' | 'copy' | 'set';
  copy_from: string;
  targets: Array<{ metric: string; daily: string; weekly: string }>;
  targets_confirmed: boolean;
  launch_week: boolean;
  speed_tracked: boolean;
};

export const EMPTY_PAYLOAD: WizardPayload = {
  operator_id: '',
  not_ready_reason: '',
  case_file_id: '',
  template_slug: '',
  placement_type: 'client_placed',
  manager_profile_id: '',
  start_date: '',
  time_zone: 'America/New_York',
  working_days: [1, 2, 3, 4, 5],
  shift_start: '09:00',
  shift_end: '17:00',
  eod_deadline: '17:30',
  review_on: '',
  schedule_confirmed: false,
  activity_categories: [],
  tracks_results: false,
  work_confirmed: false,
  outcomes: [],
  offer: { ...EMPTY_OFFER },
  offer_confirmed: false,
  reporting: {
    recipients: [],
    extra: [],
    cc_manager: true,
    send_dow: 1,
    send_time: '09:00',
    daily: false,
    approval: true,
    intro: 'activation',
    intro_on: '',
  },
  reporting_confirmed: false,
  ghl: { phone: '', user_id: '', user_pending: false, mapping: {} },
  ghl_suggestions: {},
  mapping_confirmed: false,
  first_day: [],
  targets_mode: 'empty',
  copy_from: '',
  targets: [],
  targets_confirmed: false,
  launch_week: true,
  speed_tracked: false,
};

export function normalizePayload(value: unknown): WizardPayload {
  const raw = value && typeof value === 'object' ? (value as Partial<WizardPayload>) : {};
  const reporting = raw.reporting ?? EMPTY_PAYLOAD.reporting;
  const ghl = raw.ghl ?? EMPTY_PAYLOAD.ghl;
  return {
    ...EMPTY_PAYLOAD,
    ...raw,
    working_days: Array.isArray(raw.working_days) ? raw.working_days.map(Number) : EMPTY_PAYLOAD.working_days,
    activity_categories: Array.isArray(raw.activity_categories) ? raw.activity_categories.map(String) : [],
    outcomes: Array.isArray(raw.outcomes) ? raw.outcomes : [],
    first_day: Array.isArray(raw.first_day) ? raw.first_day.map(String) : [],
    targets: Array.isArray(raw.targets) ? raw.targets : [],
    offer: { ...EMPTY_OFFER, ...(raw.offer ?? {}) },
    reporting: { ...EMPTY_PAYLOAD.reporting, ...reporting, recipients: reporting.recipients ?? [], extra: reporting.extra ?? [] },
    ghl: { ...EMPTY_PAYLOAD.ghl, ...ghl, mapping: ghl.mapping ?? {} },
    ghl_suggestions: raw.ghl_suggestions ?? {},
  };
}

export type CheckItem = {
  key: string;
  label: string;
  fix?: string;
  href?: string;
  gate?: 'activation' | 'two_days' | 'first_report';
  automatic?: boolean;
  met: boolean;
  waived?: boolean;
  waiver_reason?: string | null;
  overdue?: boolean;
  blocking?: boolean;
  open?: boolean;
  checked_at?: string | null;
  checked_by?: string | null;
};

export type BoardRow = {
  placement_id: string | null;
  wizard_id: string | null;
  operator: string | null;
  client: string | null;
  manager: string | null;
  start_date: string | null;
  display_status: string;
  ghl_status: string;
  open_items: number | null;
};
