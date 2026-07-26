import type { Json } from '@/lib/supabase/database.types';

/**
 * The shape the resolver produces and the renderer consumes.
 *
 * A bound field always carries its status. `gap` means the tracked record had no
 * value, which the renderer prints as an explicit gap rather than a zero: a
 * missing number and a zero mean completely different things, and a report that
 * silently prints zero for missing data is worse than one that says the figure was
 * not captured.
 */

export type BoundStatus = 'resolved' | 'gap';

export type BoundField = {
  label: string;
  value?: number | null;
  text?: string | null;
  unit?: string | null;
  status: BoundStatus;
  source?: string | null;
  note?: string | null;
  key?: string;
  category?: string | null;
  measurement?: string | null;
  measurement_note?: string | null;
  source_name?: string | null;
};

export type GrowthRow = {
  key: string;
  label: string;
  unit: string | null;
  category: string | null;
  direction: 'up_is_good' | 'down_is_good';
  baseline: BoundField;
  current: BoundField;
  absolute_change: number | null;
  percent_change: number | null;
  improved: boolean | null;
  status: BoundStatus;
};

export type MilestoneRow = {
  occurred_on: string;
  type: string;
  title: string;
  description: string | null;
  automatic: boolean;
};

export type EffortRow = { performed_on: string; phase: string | null; description: string };

export type EvidenceRow = {
  id: string;
  filename: string;
  what_it_proves: string | null;
  happened_on: string | null;
  thumbnail_url: string | null;
};

export type ScopeRow = {
  requested_on: string;
  summary: string;
  verdict: 'in_scope' | 'out_of_scope';
  quotes: { proposed_on: string; summary: string; amount: number | null; status: string }[];
};

export type TrajectoryMetric = {
  key: string;
  label: string;
  unit: string | null;
  direction: 'up_is_good' | 'down_is_good';
  points: { kind: 'baseline' | 'progress'; period_end: string | null; value: number }[];
};

export type BoundBlock = {
  captured?: boolean;
  withheld?: boolean;
  as_at?: string | null;
  period?: { start: string | null; end: string | null };
  taken_at?: string | null;
  rows?: unknown[];
  lead_sources?: BoundField[];
  tooling?: string[];
  folders?: { category: string; url: string | null }[];
  components?: { title: string; description: string | null; occurred_on: string }[];
  metrics?: TrajectoryMetric[];
  terms?: BoundField[];
};

export type DocumentSection = {
  key: string;
  title: string;
  kind: 'fixed' | 'narrative' | 'bound_metrics' | 'bound_table' | 'milestones' | 'evidence' | 'effort' | 'scope';
  sort_order: number;
  body: string | null;
  bound_data: BoundBlock | null;
  has_gap: boolean;
};

export type DocumentPayload = {
  document: {
    id: string;
    type: string;
    title: string;
    version: number;
    state: string;
    period_start: string | null;
    period_end: string | null;
    generated_at: string;
    published_at: string | null;
    correction_note: string | null;
    is_case_study: boolean;
    include_effort: boolean;
  };
  client: {
    name: string;
    vertical: string | null;
    contact_name?: string | null;
    logo_url: string | null;
    anonymised: boolean;
  };
  producer_line: string;
  template: { name: string; version: number };
  sections: DocumentSection[];
};

/**
 * A published document renders from its frozen payload; a draft renders from the
 * live rows. Both arrive here as `Json`, so this is the one cast in the pipeline.
 */
export function asPayload(value: Json | null | undefined): DocumentPayload | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as unknown as DocumentPayload;
}
