'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  cancelDocuSealSubmission,
  createDocuSealSubmission,
  fetchSignedDocumentUrl,
} from './docuseal';
import { requireAdmin, workspaceClient } from './db';
import { publicCalendarUrl, publicPageUrl } from './paths';
import {
  createToken,
  recipientVariableValues,
  resolveVariables,
} from './tokens';
import type { ActionResult, DaSettings, RecipientStatus, RecipientType } from './types';

function revalidateWorkspace() {
  revalidatePath('/workspace');
  revalidatePath('/workspace/recipients');
  revalidatePath('/workspace/agreements');
  revalidatePath('/workspace/templates');
  revalidatePath('/workspace/calendar-links');
  revalidatePath('/workspace/settings');
}

function parseExpiry(value: string | null | undefined): string | null {
  const raw = (value ?? '').trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

async function loadSettings(): Promise<DaSettings | null> {
  const supabase = await workspaceClient();
  if (!supabase) return null;
  const { data } = await supabase.from('da_settings').select('*').eq('id', 1).maybeSingle();
  return (data as DaSettings | null) ?? null;
}

export async function signInAction(formData: FormData): Promise<ActionResult> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const supabase = await workspaceClient();
  if (!supabase) return { ok: false, error: 'Invalid email or password' };

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: 'Invalid email or password' };

  const session = await requireAdmin();
  if (!session) {
    await supabase.auth.signOut();
    return { ok: false, error: 'Invalid email or password' };
  }

  redirect('/workspace/recipients');
}

export async function signOutAction() {
  const supabase = await workspaceClient();
  if (supabase) await supabase.auth.signOut();
  redirect('/workspace/login');
}

export async function createRecipientAction(formData: FormData): Promise<ActionResult> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return { ok: false, error: 'Admin access required.' };

  const full_name = String(formData.get('full_name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const phone = String(formData.get('phone') ?? '').trim() || null;
  const recipient_type = String(formData.get('recipient_type') ?? '') as RecipientType;
  const business_name = String(formData.get('business_name') ?? '').trim() || null;
  const status = (String(formData.get('status') ?? 'active') as RecipientStatus) || 'active';
  const notes = String(formData.get('notes') ?? '').trim() || null;

  if (!full_name || !email || (recipient_type !== 'client' && recipient_type !== 'operator')) {
    return { ok: false, error: 'Name, email, and type are required.' };
  }
  if (recipient_type === 'client' && !business_name) {
    return { ok: false, error: 'Business name is required for client recipients.' };
  }

  const { error } = await supabase.from('da_recipient').insert({
    full_name,
    email,
    phone,
    recipient_type,
    business_name: recipient_type === 'client' ? business_name : null,
    status,
    notes,
  });

  if (error) return { ok: false, error: error.message };
  revalidateWorkspace();
  return { ok: true, message: 'Recipient created.' };
}

export async function updateRecipientAction(formData: FormData): Promise<ActionResult> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return { ok: false, error: 'Admin access required.' };

  const id = String(formData.get('id') ?? '');
  const full_name = String(formData.get('full_name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const phone = String(formData.get('phone') ?? '').trim() || null;
  const recipient_type = String(formData.get('recipient_type') ?? '') as RecipientType;
  const business_name = String(formData.get('business_name') ?? '').trim() || null;
  const status = String(formData.get('status') ?? 'active') as RecipientStatus;
  const notes = String(formData.get('notes') ?? '').trim() || null;

  if (!id || !full_name || !email) return { ok: false, error: 'Missing required fields.' };
  if (recipient_type === 'client' && !business_name) {
    return { ok: false, error: 'Business name is required for client recipients.' };
  }

  const { error } = await supabase
    .from('da_recipient')
    .update({
      full_name,
      email,
      phone,
      recipient_type,
      business_name: recipient_type === 'client' ? business_name : null,
      status,
      notes,
    })
    .eq('id', id);

  if (error) return { ok: false, error: error.message };
  revalidateWorkspace();
  revalidatePath(`/workspace/recipients/${id}`);
  return { ok: true, message: 'Recipient updated.' };
}

export async function upsertPageTemplateAction(formData: FormData): Promise<ActionResult> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return { ok: false, error: 'Admin access required.' };

  const id = String(formData.get('id') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();
  const body_markdown = String(formData.get('body_markdown') ?? '');
  const variablesRaw = String(formData.get('variables') ?? 'recipient_name,business_name,email,date');
  const variables = variablesRaw
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

  if (!name || !title) return { ok: false, error: 'Name and title are required.' };

  if (id) {
    const { error } = await supabase
      .from('da_page_template')
      .update({ name, title, body_markdown, variables })
      .eq('id', id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from('da_page_template').insert({
      name,
      title,
      body_markdown,
      variables,
    });
    if (error) return { ok: false, error: error.message };
  }

  revalidateWorkspace();
  return { ok: true, message: id ? 'Page template updated.' : 'Page template created.' };
}

export async function upsertAgreementTemplateAction(formData: FormData): Promise<ActionResult> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return { ok: false, error: 'Admin access required.' };

  const id = String(formData.get('id') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const recipient_type = String(formData.get('recipient_type') ?? '') as RecipientType;
  const docuseal_template_id = String(formData.get('docuseal_template_id') ?? '').trim();
  const pageIds = formData.getAll('page_template_ids').map(String);
  const fieldNames = formData.getAll('docuseal_field_names').map(String);

  if (!name || !docuseal_template_id || (recipient_type !== 'client' && recipient_type !== 'operator')) {
    return { ok: false, error: 'Name, type, and DocuSeal template id are required.' };
  }

  let templateId = id;
  if (id) {
    const { error } = await supabase
      .from('da_agreement_template')
      .update({ name, description, recipient_type, docuseal_template_id })
      .eq('id', id);
    if (error) return { ok: false, error: error.message };
    await supabase.from('da_agreement_template_page').delete().eq('agreement_template_id', id);
  } else {
    const { data, error } = await supabase
      .from('da_agreement_template')
      .insert({ name, description, recipient_type, docuseal_template_id })
      .select('id')
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? 'Failed to create template.' };
    templateId = data.id as string;
  }

  const attachments = pageIds
    .map((pageId, index) => ({
      agreement_template_id: templateId,
      page_template_id: pageId,
      docuseal_field_name: (fieldNames[index] ?? '').trim() || `page_url_${index + 1}`,
      sort_order: index,
    }))
    .filter((row) => row.page_template_id);

  if (attachments.length > 0) {
    const { error } = await supabase.from('da_agreement_template_page').insert(attachments);
    if (error) return { ok: false, error: error.message };
  }

  revalidateWorkspace();
  return { ok: true, message: id ? 'Template updated.' : 'Template created.' };
}

async function createPageTokensForTemplate(input: {
  supabase: NonNullable<Awaited<ReturnType<typeof workspaceClient>>>;
  templateId: string;
  recipientId: string;
  agreementId: string;
  baseUrl: string;
}): Promise<{ fields: { name: string; default_value: string; readonly: boolean }[]; error?: string }> {
  const { data: recipient } = await input.supabase
    .from('da_recipient')
    .select('*')
    .eq('id', input.recipientId)
    .maybeSingle();
  if (!recipient) return { fields: [], error: 'Recipient not found.' };

  const { data: attachments } = await input.supabase
    .from('da_agreement_template_page')
    .select('*, da_page_template(*)')
    .eq('agreement_template_id', input.templateId)
    .order('sort_order', { ascending: true });

  const fields: { name: string; default_value: string; readonly: boolean }[] = [];

  for (const attachment of (attachments as any[] | null) ?? []) {
    const page = attachment.da_page_template;
    if (!page) continue;
    const token = createToken();
    const resolved = resolveVariables(page.variables ?? [], recipientVariableValues(recipient));
    const { error } = await input.supabase.from('da_page_token').insert({
      page_template_id: page.id,
      recipient_id: input.recipientId,
      agreement_id: input.agreementId,
      token,
      resolved_values: resolved,
    });
    if (error) return { fields: [], error: error.message };
    fields.push({
      name: attachment.docuseal_field_name,
      default_value: publicPageUrl(input.baseUrl, token),
      readonly: true,
    });
  }

  return { fields };
}

export async function sendAgreementAction(formData: FormData): Promise<ActionResult> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return { ok: false, error: 'Admin access required.' };

  const recipientId = String(formData.get('recipient_id') ?? '');
  const templateId = String(formData.get('template_id') ?? '');
  if (!recipientId || !templateId) return { ok: false, error: 'Recipient and template are required.' };

  const settings = await loadSettings();
  if (!settings) return { ok: false, error: 'Settings could not be loaded.' };
  if (!settings.public_base_url.trim()) {
    return { ok: false, error: 'Set the public base URL in settings before sending agreements.' };
  }

  const { data: recipient } = await supabase
    .from('da_recipient')
    .select('*')
    .eq('id', recipientId)
    .maybeSingle();
  if (!recipient) return { ok: false, error: 'Recipient not found.' };

  const { data: template } = await supabase
    .from('da_agreement_template')
    .select('*')
    .eq('id', templateId)
    .maybeSingle();
  if (!template) return { ok: false, error: 'Template not found.' };

  // Create local agreement first so tokens can reference it; DocuSeal comes after tokens.
  const { data: agreement, error: agreementError } = await supabase
    .from('da_agreement')
    .insert({
      recipient_id: recipientId,
      template_id: templateId,
      status: 'sent',
      sent_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (agreementError || !agreement) {
    return { ok: false, error: agreementError?.message ?? 'Failed to create agreement record.' };
  }

  const { fields, error: tokenError } = await createPageTokensForTemplate({
    supabase,
    templateId,
    recipientId,
    agreementId: agreement.id,
    baseUrl: settings.public_base_url,
  });
  if (tokenError) return { ok: false, error: tokenError };

  const docuseal = await createDocuSealSubmission({
    settings,
    templateId: template.docuseal_template_id,
    email: recipient.email,
    name: recipient.full_name,
    phone: recipient.phone,
    fields,
    externalId: agreement.id,
  });

  if (docuseal.error || !docuseal.submissionId) {
    await supabase.from('da_agreement').update({ status: 'declined' }).eq('id', agreement.id);
    return { ok: false, error: docuseal.error ?? 'DocuSeal submission failed.' };
  }

  await supabase
    .from('da_agreement')
    .update({
      docuseal_submission_id: docuseal.submissionId,
      signing_url: docuseal.signingUrl,
    })
    .eq('id', agreement.id);

  revalidateWorkspace();
  revalidatePath(`/workspace/recipients/${recipientId}`);
  return {
    ok: true,
    message: 'Agreement sent.',
    data: { agreementId: agreement.id, signingUrl: docuseal.signingUrl ?? '' },
  };
}

export async function resendAgreementAction(formData: FormData): Promise<ActionResult> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return { ok: false, error: 'Admin access required.' };

  const agreementId = String(formData.get('agreement_id') ?? '');
  const { data: previous } = await supabase
    .from('da_agreement')
    .select('*')
    .eq('id', agreementId)
    .maybeSingle();
  if (!previous) return { ok: false, error: 'Agreement not found.' };

  const result = await sendAgreementAction(
    (() => {
      const fd = new FormData();
      fd.set('recipient_id', previous.recipient_id);
      fd.set('template_id', previous.template_id);
      return fd;
    })(),
  );

  if (!result.ok) return result;

  const newId = String(result.data?.agreementId ?? '');
  if (newId) {
    await supabase.from('da_agreement').update({ superseded_by_id: newId }).eq('id', agreementId);
  }

  revalidateWorkspace();
  return { ok: true, message: 'Agreement resent. Previous submission superseded.' };
}

export async function voidAgreementAction(formData: FormData): Promise<ActionResult> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return { ok: false, error: 'Admin access required.' };

  const agreementId = String(formData.get('agreement_id') ?? '');
  const { data: agreement } = await supabase
    .from('da_agreement')
    .select('*')
    .eq('id', agreementId)
    .maybeSingle();
  if (!agreement) return { ok: false, error: 'Agreement not found.' };

  const settings = await loadSettings();
  if (settings && agreement.docuseal_submission_id) {
    await cancelDocuSealSubmission(settings, agreement.docuseal_submission_id);
  }

  const { error } = await supabase
    .from('da_agreement')
    .update({ status: 'declined' })
    .eq('id', agreementId);

  if (error) return { ok: false, error: error.message };
  revalidateWorkspace();
  return { ok: true, message: 'Agreement voided.' };
}

export async function downloadSignedDocumentAction(formData: FormData): Promise<ActionResult> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return { ok: false, error: 'Admin access required.' };

  const agreementId = String(formData.get('agreement_id') ?? '');
  const { data: agreement } = await supabase
    .from('da_agreement')
    .select('*')
    .eq('id', agreementId)
    .maybeSingle();
  if (!agreement) return { ok: false, error: 'Agreement not found.' };
  if (agreement.status !== 'completed') {
    return { ok: false, error: 'Signed document is only available after completion.' };
  }

  const settings = await loadSettings();
  if (!settings || !agreement.docuseal_submission_id) {
    return { ok: false, error: 'Unable to fetch signed document.' };
  }

  const url =
    (await fetchSignedDocumentUrl(settings, agreement.docuseal_submission_id)) ??
    agreement.signed_document_url;
  if (!url) return { ok: false, error: 'No signed document URL available.' };

  if (url !== agreement.signed_document_url) {
    await supabase.from('da_agreement').update({ signed_document_url: url }).eq('id', agreementId);
  }

  return { ok: true, message: 'Signed document ready.', data: { url } };
}

export async function generatePageTokenAction(formData: FormData): Promise<ActionResult> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return { ok: false, error: 'Admin access required.' };

  const pageTemplateId = String(formData.get('page_template_id') ?? '');
  const recipientId = String(formData.get('recipient_id') ?? '');
  const expiresAt = parseExpiry(String(formData.get('expires_at') ?? ''));

  const [{ data: page }, { data: recipient }, settings] = await Promise.all([
    supabase.from('da_page_template').select('*').eq('id', pageTemplateId).maybeSingle(),
    supabase.from('da_recipient').select('*').eq('id', recipientId).maybeSingle(),
    loadSettings(),
  ]);

  if (!page || !recipient) return { ok: false, error: 'Page template and recipient are required.' };
  if (!settings?.public_base_url) {
    return { ok: false, error: 'Set the public base URL in settings first.' };
  }

  const token = createToken();
  const resolved = resolveVariables(page.variables ?? [], recipientVariableValues(recipient));
  const { error } = await supabase.from('da_page_token').insert({
    page_template_id: pageTemplateId,
    recipient_id: recipientId,
    token,
    resolved_values: resolved,
    expires_at: expiresAt,
  });

  if (error) return { ok: false, error: error.message };
  revalidateWorkspace();
  revalidatePath(`/workspace/recipients/${recipientId}`);
  return {
    ok: true,
    message: 'Token created.',
    data: { url: publicPageUrl(settings.public_base_url, token), token },
  };
}

export async function updatePageTokenAction(formData: FormData): Promise<ActionResult> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return { ok: false, error: 'Admin access required.' };

  const id = String(formData.get('id') ?? '');
  const action = String(formData.get('action') ?? '');
  const expiresAt = String(formData.get('expires_at') ?? '').trim();

  if (action === 'revoke') {
    const { error } = await supabase.from('da_page_token').update({ revoked: true }).eq('id', id);
    if (error) return { ok: false, error: error.message };
  } else if (action === 'set_expiry') {
    const { error } = await supabase
      .from('da_page_token')
      .update({ expires_at: parseExpiry(expiresAt) })
      .eq('id', id);
    if (error) return { ok: false, error: error.message };
  } else if (action === 'clear_expiry') {
    const { error } = await supabase.from('da_page_token').update({ expires_at: null }).eq('id', id);
    if (error) return { ok: false, error: error.message };
  } else {
    return { ok: false, error: 'Unknown action.' };
  }

  revalidateWorkspace();
  return { ok: true, message: 'Token updated.' };
}

export async function createCalendarLinkAction(formData: FormData): Promise<ActionResult> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return { ok: false, error: 'Admin access required.' };

  const name = String(formData.get('name') ?? '').trim();
  const recipientId = String(formData.get('recipient_id') ?? '');
  const destination = String(formData.get('destination_url') ?? '').trim();
  const expiresAt = parseExpiry(String(formData.get('expires_at') ?? ''));
  const settings = await loadSettings();

  const destination_url = destination || settings?.default_booking_url?.trim() || '';
  if (!name || !recipientId || !destination_url) {
    return { ok: false, error: 'Name, recipient, and destination URL are required.' };
  }
  if (!settings?.public_base_url) {
    return { ok: false, error: 'Set the public base URL in settings first.' };
  }

  const token = createToken();
  const { error } = await supabase.from('da_calendar_link').insert({
    name,
    destination_url,
    recipient_id: recipientId,
    token,
    expires_at: expiresAt,
  });

  if (error) return { ok: false, error: error.message };
  revalidateWorkspace();
  return {
    ok: true,
    message: 'Calendar link created.',
    data: { url: publicCalendarUrl(settings.public_base_url, token), token },
  };
}

export async function updateCalendarLinkAction(formData: FormData): Promise<ActionResult> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return { ok: false, error: 'Admin access required.' };

  const id = String(formData.get('id') ?? '');
  const action = String(formData.get('action') ?? '');
  const expiresAt = String(formData.get('expires_at') ?? '').trim();

  if (action === 'revoke') {
    const { error } = await supabase.from('da_calendar_link').update({ revoked: true }).eq('id', id);
    if (error) return { ok: false, error: error.message };
  } else if (action === 'set_expiry') {
    const { error } = await supabase
      .from('da_calendar_link')
      .update({ expires_at: parseExpiry(expiresAt) })
      .eq('id', id);
    if (error) return { ok: false, error: error.message };
  } else if (action === 'clear_expiry') {
    const { error } = await supabase.from('da_calendar_link').update({ expires_at: null }).eq('id', id);
    if (error) return { ok: false, error: error.message };
  } else {
    return { ok: false, error: 'Unknown action.' };
  }

  revalidateWorkspace();
  return { ok: true, message: 'Calendar link updated.' };
}

export async function saveSettingsAction(formData: FormData): Promise<ActionResult> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return { ok: false, error: 'Admin access required.' };

  const current = await loadSettings();
  const keepIfBlank = (key: string, existing: string) => {
    const value = String(formData.get(key) ?? '');
    if (value === '' && formData.get(`${key}_keep`) === '1') return existing;
    return value.trim();
  };

  const payload = {
    docuseal_api_key: keepIfBlank('docuseal_api_key', current?.docuseal_api_key ?? ''),
    docuseal_account_id: String(formData.get('docuseal_account_id') ?? '').trim(),
    docuseal_webhook_secret: keepIfBlank(
      'docuseal_webhook_secret',
      current?.docuseal_webhook_secret ?? '',
    ),
    default_booking_url: String(formData.get('default_booking_url') ?? '').trim(),
    public_base_url: String(formData.get('public_base_url') ?? '').trim().replace(/\/+$/, ''),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('da_settings').upsert({ id: 1, ...payload });
  if (error) return { ok: false, error: error.message };
  revalidateWorkspace();
  return { ok: true, message: 'Settings saved.' };
}
