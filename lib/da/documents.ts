import { createClient, isAdminSession } from '@/lib/supabase/server';
import { asPayload, type DocumentPayload, type DocumentSection } from '@/lib/documents/payload';
import type { Database } from '@/lib/supabase/database.types';

/**
 * Reads for the document workspace. RLS does the access control, so an operator's
 * or a client's session simply returns nothing here.
 */

export type DocumentRow = Database['public']['Tables']['document']['Row'];
export type DocumentIndexRow = Database['public']['Views']['v_document_index']['Row'];
export type DocumentAttentionRow = Database['public']['Views']['v_document_attention']['Row'];
export type AnonymisationFlag = Database['public']['Tables']['anonymisation_flag']['Row'];
export type DocumentTemplate = Database['public']['Tables']['document_template']['Row'];
export type DocumentType = Database['public']['Enums']['document_type'];

export async function listDocuments(caseFileId: string) {
  if (!(await isAdminSession())) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('v_document_index')
    .select('*')
    .eq('case_file_id', caseFileId)
    .order('generated_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** The register: what was sent to whom, and when, across every engagement. */
export async function listAllDocuments(limit = 200) {
  if (!(await isAdminSession())) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('v_document_index')
    .select('*')
    .order('generated_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function listDocumentAttention() {
  if (!(await isAdminSession())) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from('v_document_attention').select('*').order('client_name');
  if (error) throw error;
  return data ?? [];
}

export async function listTemplates() {
  if (!(await isAdminSession())) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('document_template')
    .select('*')
    .eq('is_current', true)
    .order('type');
  if (error) throw error;
  return data ?? [];
}

export type DocumentDetail = {
  document: DocumentRow;
  sections: DocumentSection[];
  /** Prompts stay on the template so they never leak into the document itself. */
  prompts: Record<string, { body: string | null; required: boolean }>;
  flags: AnonymisationFlag[];
  opens: { opened_at: string; via: string }[];
  deliveries: { channel: string; status: string; detail: string | null; delivered_at: string }[];
  /** A published document renders from its frozen payload, a draft from live rows. */
  payload: DocumentPayload | null;
  clientName: string;
  clientSlug: string;
};

export async function getDocument(documentId: string): Promise<DocumentDetail | null> {
  if (!(await isAdminSession())) return null;
  const supabase = await createClient();

  const { data: document, error } = await supabase
    .from('document')
    .select('*, client_case_file!inner(name, slug, vertical, logo_url, contact_name)')
    .eq('id', documentId)
    .maybeSingle();

  if (error) throw error;
  if (!document) return null;

  const caseFile = document.client_case_file as unknown as {
    name: string;
    slug: string;
    vertical: string | null;
    logo_url: string | null;
    contact_name: string | null;
  };

  const [sections, template, flags, opens, deliveries] = await Promise.all([
    supabase
      .from('document_section')
      .select('key, title, kind, sort_order, body, bound_data, has_gap')
      .eq('document_id', documentId)
      .order('sort_order'),
    supabase
      .from('document_template')
      .select('name, producer_line, document_template_section(key, body, required)')
      .eq('id', document.template_id)
      .maybeSingle(),
    supabase
      .from('anonymisation_flag')
      .select('*')
      .eq('document_id', documentId)
      .order('created_at'),
    supabase
      .from('document_open')
      .select('opened_at, via')
      .eq('document_id', documentId)
      .order('opened_at', { ascending: false }),
    supabase
      .from('document_delivery')
      .select('channel, status, detail, delivered_at')
      .eq('document_id', documentId)
      .order('delivered_at'),
  ]);

  const liveSections = (sections.data ?? []) as unknown as DocumentSection[];

  const prompts: DocumentDetail['prompts'] = {};
  const templateSections =
    (template.data?.document_template_section as unknown as
      | { key: string; body: string | null; required: boolean }[]
      | undefined) ?? [];
  for (const section of templateSections) {
    prompts[section.key] = { body: section.body, required: section.required };
  }

  const frozen = asPayload(document.frozen_payload);

  return {
    document: document as unknown as DocumentRow,
    sections: liveSections,
    prompts,
    // Longest snippet first, so the admin is offered "Lumen Aesthetics" before
    // "Lumen" on its own. Rewriting a part before the whole leaves a fragment of
    // the original behind.
    flags: ((flags.data ?? []) as AnonymisationFlag[]).sort(
      (a, b) => b.snippet.length - a.snippet.length,
    ),
    opens: opens.data ?? [],
    deliveries: deliveries.data ?? [],
    payload:
      frozen ??
      buildLivePayload(document as unknown as DocumentRow, liveSections, caseFile, {
        name: template.data?.name ?? '',
        producerLine: template.data?.producer_line ?? 'Prepared by Divine Acquisition',
      }),
    clientName: caseFile.name,
    clientSlug: caseFile.slug,
  };
}

/**
 * The same shape `app.document_payload()` produces, assembled client side for a
 * draft. The renderer therefore never knows whether it is drawing a draft or the
 * frozen record, which is what makes the review preview trustworthy.
 */
function buildLivePayload(
  document: DocumentRow,
  sections: DocumentSection[],
  caseFile: { name: string; vertical: string | null; logo_url: string | null; contact_name: string | null },
  template: { name: string; producerLine: string },
): DocumentPayload {
  return {
    document: {
      id: document.id,
      type: document.type,
      title: document.title,
      version: document.version,
      state: document.state,
      period_start: document.period_start,
      period_end: document.period_end,
      generated_at: document.generated_at,
      published_at: document.published_at,
      correction_note: document.correction_note,
      is_case_study: document.is_case_study,
      include_effort: document.include_effort,
    },
    client: document.is_case_study
      ? {
          name: document.anonymised_descriptor ?? 'A client',
          vertical: caseFile.vertical,
          logo_url: null,
          anonymised: true,
        }
      : {
          name: caseFile.name,
          vertical: caseFile.vertical,
          contact_name: caseFile.contact_name,
          logo_url: caseFile.logo_url,
          anonymised: false,
        },
    producer_line: template.producerLine,
    template: { name: template.name, version: document.template_version },
    sections,
  };
}
