'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { driveConfigured, uploadGeneratedDocument } from '@/lib/drive/client';
import { asPayload } from '@/lib/documents/payload';
import { serialiseDocument } from '@/lib/documents/serialise';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/database.types';

/**
 * Writes for the document workspace. Every one goes through a database function,
 * so the rules live in one place: the UI cannot type over a bound number, publish
 * without a review, edit a published document, or mark a case study ready with an
 * unconfirmed identifier by any route other than the one that enforces the rule.
 */

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

type DocumentRow = Database['public']['Tables']['document']['Row'];
type DocumentType = Database['public']['Enums']['document_type'];

function readable(error: { message: string } | null): string {
  if (!error) return 'Something went wrong.';
  const match = error.message.match(/^[a-z_]+:\s*([\s\S]+)$/);
  return match ? match[1] : error.message;
}

const casePath = (slug: string) => `/da/${slug}/documents`;
const documentPath = (slug: string, id: string) => `/da/${slug}/documents/${id}`;

// ---------------------------------------------------------------------------
// Generate and refresh
// ---------------------------------------------------------------------------

export async function generateDocumentAction(
  caseFileId: string,
  slug: string,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('generate_document', {
    p_case_file_id: caseFileId,
    p_type: formData.get('type') as DocumentType,
    p_period_start: (formData.get('period_start') as string) || undefined,
    p_period_end: (formData.get('period_end') as string) || undefined,
    p_include_effort: formData.get('include_effort') === 'on',
    p_title: (formData.get('title') as string) || undefined,
  });

  if (error) return { ok: false, error: readable(error) };

  const document = data as unknown as DocumentRow;
  revalidatePath(casePath(slug));
  redirect(documentPath(slug, document.id));
}

export async function refreshBindingsAction(
  documentId: string,
  slug: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('refresh_document_bindings', { p_document_id: documentId });
  if (error) return { ok: false, error: readable(error) };

  revalidatePath(documentPath(slug, documentId));
  return { ok: true, message: 'Bound figures re-read from the tracked record.' };
}

// ---------------------------------------------------------------------------
// Narrative
// ---------------------------------------------------------------------------

export async function setNarrativeAction(
  documentId: string,
  slug: string,
  sectionKey: string,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_document_narrative', {
    p_document_id: documentId,
    p_section_key: sectionKey,
    p_body: String(formData.get('body') ?? ''),
  });

  if (error) return { ok: false, error: readable(error) };

  revalidatePath(documentPath(slug, documentId));
  return { ok: true, message: 'Saved.' };
}

// ---------------------------------------------------------------------------
// Review, publish, correct, archive
// ---------------------------------------------------------------------------

export async function submitForReviewAction(documentId: string, slug: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('submit_document_for_review', { p_document_id: documentId });
  if (error) return { ok: false, error: readable(error) };

  revalidatePath(documentPath(slug, documentId));
  return { ok: true, message: 'Locked for a final read. Check the preview before releasing it.' };
}

export async function publishDocumentAction(documentId: string, slug: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('publish_document', { p_document_id: documentId });
  if (error) return { ok: false, error: readable(error) };

  const document = data as unknown as DocumentRow;

  // The Drive copy is written from the frozen payload, so the file in the client's
  // Reports folder and the copy in their account are the same document. Without
  // credentials the publication still stands and the copy can be attached later.
  if (driveConfigured()) {
    try {
      const payload = asPayload(document.frozen_payload);
      const { data: folder } = await supabase
        .from('case_file_drive_folder')
        .select('folder_id')
        .eq('case_file_id', document.case_file_id)
        .eq('category', 'reports')
        .maybeSingle();

      if (payload && folder?.folder_id) {
        const stamp = (document.published_at ?? document.generated_at).slice(0, 10);
        const file = await uploadGeneratedDocument(
          folder.folder_id,
          `${stamp} ${payload.client.name} ${document.title}${document.version > 1 ? ` v${document.version}` : ''}`,
          serialiseDocument(payload),
        );
        await supabase.rpc('attach_document_to_drive', {
          p_document_id: documentId,
          p_drive_file_id: file.id,
          p_drive_url: file.webViewLink,
        });
      }
    } catch (driveError) {
      console.error('drive document archive failed', driveError);
    }
  }

  revalidatePath(documentPath(slug, documentId));
  revalidatePath(casePath(slug));
  revalidatePath('/da/documents');
  return { ok: true, message: 'Published. The numbers in it are now frozen.' };
}

export async function correctDocumentAction(
  documentId: string,
  slug: string,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('correct_document', {
    p_document_id: documentId,
    p_correction_note: String(formData.get('correction_note') ?? ''),
  });

  if (error) return { ok: false, error: readable(error) };

  const document = data as unknown as DocumentRow;
  revalidatePath(casePath(slug));
  redirect(documentPath(slug, document.id));
}

export async function archiveDocumentAction(documentId: string, slug: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('archive_document', { p_document_id: documentId });
  if (error) return { ok: false, error: readable(error) };

  revalidatePath(documentPath(slug, documentId));
  revalidatePath(casePath(slug));
  return { ok: true, message: 'Archived. It stays readable and is no longer editable.' };
}

// ---------------------------------------------------------------------------
// Case study mode
// ---------------------------------------------------------------------------

export async function createCaseStudyAction(
  documentId: string,
  slug: string,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('create_case_study_draft', {
    p_document_id: documentId,
    p_descriptor: String(formData.get('descriptor') ?? ''),
  });

  if (error) return { ok: false, error: readable(error) };

  const document = data as unknown as DocumentRow;
  revalidatePath(casePath(slug));
  redirect(documentPath(slug, document.id));
}

export async function resolveFlagAction(
  flagId: string,
  documentId: string,
  slug: string,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  const replacement = String(formData.get('replacement') ?? '').trim();

  const { error } = await supabase.rpc('resolve_anonymisation_flag', {
    p_flag_id: flagId,
    p_replacement: replacement || undefined,
  });

  if (error) return { ok: false, error: readable(error) };

  revalidatePath(documentPath(slug, documentId));
  return {
    ok: true,
    message: replacement ? 'Rewritten and confirmed.' : 'Confirmed as not identifying.',
  };
}

export async function markCaseStudyReadyAction(documentId: string, slug: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('mark_case_study_ready', { p_document_id: documentId });
  if (error) return { ok: false, error: readable(error) };

  revalidatePath(documentPath(slug, documentId));
  return { ok: true, message: 'Anonymisation confirmed. The draft is usable as a sales asset.' };
}
