import 'server-only';

import { serviceRoleClient } from '@/lib/workspace/db';

export type InquiryKind = 'diagnostic' | 'discovery' | 'sales_review' | 'cleaning_audit';

export type InquiryCapture = {
  kind: InquiryKind;
  email: string;
  fullName?: string | null;
  company?: string | null;
  phone?: string | null;
  /** Label and answer pairs, as the team alert shows them. */
  answers: Array<[string, string]>;
  /** The submission id when the form has one (a UUID). */
  inquiryId?: string | null;
  ghlContactId?: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Writes the inquiry into the workspace Pipeline: the lead for this email is
 * created or updated, and the answers are kept. Returns the lead id. A booking
 * made afterwards finds the lead by email.
 */
export async function captureInquiry(input: InquiryCapture): Promise<string> {
  const db = serviceRoleClient();
  if (!db) throw new Error('pipeline_unavailable: SUPABASE_SERVICE_ROLE_KEY is required');
  const { data, error } = await db.rpc('site_capture_inquiry', {
    p: {
      kind: input.kind,
      email: input.email,
      full_name: input.fullName ?? null,
      company: input.company ?? null,
      phone: input.phone ?? null,
      answers: input.answers.map(([label, value]) => [label.slice(0, 200), value.slice(0, 4000)]),
      inquiry_id: input.inquiryId && UUID.test(input.inquiryId) ? input.inquiryId : null,
      ghl_contact_id: input.ghlContactId ?? null,
    },
  });
  if (error) throw new Error(`pipeline_capture_failed: ${error.message}`);
  if (typeof data !== 'string' || !data) throw new Error('pipeline_capture_failed: no lead id');
  return data;
}

export { answersFromNote } from './desk';
