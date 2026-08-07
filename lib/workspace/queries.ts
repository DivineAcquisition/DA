import { requireAdmin, workspaceClient } from './db';
import { docusealApiKey, pingDocuSeal } from './docuseal';
import {
  buildProfile,
  mapFields,
  mappingSummary,
  type MappedField,
} from './field-mapping';
import { loadFieldOverrides, loadSubmittedValues, overridesFor } from './sync';
import type {
  DaAgreement,
  DaAgreementTemplate,
  DaAgreementTemplatePage,
  DaCalendarLink,
  DaPageTemplate,
  DaPageToken,
  DaRecipient,
  DaRecipientField,
  DaSettings,
  DaSyncRun,
  DocuSealFieldDefinition,
  RecipientStatus,
  RecipientType,
  AgreementStatus,
} from './types';

/** Columns added after the first release read as undefined on old rows. */
function withSettingsDefaults(row: Record<string, unknown> | null): DaSettings | null {
  if (!row) return null;
  return {
    ...(row as DaSettings),
    auto_prefill: row.auto_prefill !== false,
    prefill_readonly: row.prefill_readonly === true,
    last_synced_at: (row.last_synced_at as string | null) ?? null,
  };
}

export async function getSettings(): Promise<DaSettings | null> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return null;
  const { data } = await supabase.from('da_settings').select('*').eq('id', 1).maybeSingle();
  return withSettingsDefaults(data as Record<string, unknown> | null);
}

export type DocuSealConnection =
  | { state: 'missing' }
  | { state: 'connected'; templates: number; source: 'settings' | 'environment' }
  | { state: 'error'; error: string; source: 'settings' | 'environment' };

/** Settings shows whether the stored key actually opens the account. */
export async function getDocuSealConnection(settings: DaSettings | null): Promise<DocuSealConnection> {
  const key = docusealApiKey(settings);
  if (!key) return { state: 'missing' };
  const source = (settings?.docuseal_api_key ?? '').trim() ? 'settings' : 'environment';
  const result = await pingDocuSeal(key);
  if (!result.ok) return { state: 'error', error: result.error, source };
  return { state: 'connected', templates: result.data.templates, source };
}

export async function getLatestSyncRun(): Promise<DaSyncRun | null> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return null;
  const { data } = await supabase
    .from('da_sync_run')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as DaSyncRun | null) ?? null;
}

export async function listRecipientFields(recipientId: string): Promise<DaRecipientField[]> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return [];
  const { data } = await supabase
    .from('da_recipient_field')
    .select('*')
    .eq('recipient_id', recipientId)
    .order('field_name', { ascending: true });
  return (data as DaRecipientField[] | null) ?? [];
}

export async function listRecipients(filters?: {
  type?: RecipientType | 'all';
  status?: RecipientStatus | 'all';
  q?: string;
}): Promise<(DaRecipient & { agreements_count: number })[]> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return [];

  let query = supabase.from('da_recipient').select('*').order('created_at', { ascending: false });
  if (filters?.type && filters.type !== 'all') query = query.eq('recipient_type', filters.type);
  if (filters?.status && filters.status !== 'all') query = query.eq('status', filters.status);

  const { data } = await query;
  let rows = (data as DaRecipient[] | null) ?? [];

  const q = filters?.q?.trim().toLowerCase();
  if (q) {
    rows = rows.filter(
      (r) =>
        r.full_name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        (r.business_name ?? '').toLowerCase().includes(q),
    );
  }

  const ids = rows.map((r) => r.id);
  const counts = new Map<string, number>();
  if (ids.length > 0) {
    const { data: agreements } = await supabase
      .from('da_agreement')
      .select('recipient_id')
      .in('recipient_id', ids)
      .is('superseded_by_id', null);
    for (const row of (agreements as { recipient_id: string }[] | null) ?? []) {
      counts.set(row.recipient_id, (counts.get(row.recipient_id) ?? 0) + 1);
    }
  }

  return rows.map((r) => ({ ...r, agreements_count: counts.get(r.id) ?? 0 }));
}

export async function getRecipient(id: string): Promise<DaRecipient | null> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return null;
  const { data } = await supabase.from('da_recipient').select('*').eq('id', id).maybeSingle();
  return (data as DaRecipient | null) ?? null;
}

export async function listAgreementsForRecipient(recipientId: string): Promise<
  (DaAgreement & { template_name: string })[]
> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return [];
  const { data } = await supabase
    .from('da_agreement')
    .select('*, da_agreement_template(name)')
    .eq('recipient_id', recipientId)
    .order('sent_at', { ascending: false });
  return ((data as any[] | null) ?? []).map((row) => ({
    ...(row as DaAgreement),
    template_name: row.da_agreement_template?.name ?? '—',
  }));
}

export async function listPageTokensForRecipient(recipientId: string): Promise<
  (DaPageToken & { page_name: string })[]
> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return [];
  const { data } = await supabase
    .from('da_page_token')
    .select('*, da_page_template(name)')
    .eq('recipient_id', recipientId)
    .order('created_at', { ascending: false });
  return ((data as any[] | null) ?? []).map((row) => ({
    ...(row as DaPageToken),
    resolved_values: (row.resolved_values ?? {}) as Record<string, string>,
    page_name: row.da_page_template?.name ?? '—',
  }));
}

export async function listCalendarLinksForRecipient(recipientId: string): Promise<DaCalendarLink[]> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return [];
  const { data } = await supabase
    .from('da_calendar_link')
    .select('*')
    .eq('recipient_id', recipientId)
    .order('created_at', { ascending: false });
  return (data as DaCalendarLink[] | null) ?? [];
}

export async function listPageTemplates(): Promise<DaPageTemplate[]> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return [];
  const { data } = await supabase.from('da_page_template').select('*').order('created_at', { ascending: false });
  return (data as DaPageTemplate[] | null) ?? [];
}

export async function listAgreementTemplates(): Promise<
  (DaAgreementTemplate & { page_count: number })[]
> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return [];
  const { data } = await supabase
    .from('da_agreement_template')
    .select('*, da_agreement_template_page(id)')
    .order('created_at', { ascending: false });
  return ((data as Record<string, unknown>[] | null) ?? []).map(templateFromRow);
}

/** Columns added after the first release read as undefined on unsynced rows. */
function templateFromRow(row: Record<string, unknown>): DaAgreementTemplate & { page_count: number } {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    description: String(row.description ?? ''),
    recipient_type: row.recipient_type as RecipientType,
    docuseal_template_id: String(row.docuseal_template_id ?? ''),
    docuseal_slug: (row.docuseal_slug as string | null) ?? null,
    docuseal_folder: (row.docuseal_folder as string | null) ?? null,
    docuseal_fields: Array.isArray(row.docuseal_fields)
      ? (row.docuseal_fields as DocuSealFieldDefinition[])
      : [],
    docuseal_submitters: Array.isArray(row.docuseal_submitters)
      ? (row.docuseal_submitters as { name?: string; uuid?: string }[])
      : [],
    archived: row.archived === true,
    synced_at: (row.synced_at as string | null) ?? null,
    created_at: String(row.created_at ?? ''),
    page_count: Array.isArray(row.da_agreement_template_page)
      ? row.da_agreement_template_page.length
      : 0,
  };
}

export async function getAgreementTemplate(id: string): Promise<{
  template: DaAgreementTemplate;
  pages: (DaAgreementTemplatePage & { page_name: string })[];
} | null> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return null;
  const { data } = await supabase.from('da_agreement_template').select('*').eq('id', id).maybeSingle();
  if (!data) return null;
  const { data: pages } = await supabase
    .from('da_agreement_template_page')
    .select('*, da_page_template(name)')
    .eq('agreement_template_id', id)
    .order('sort_order', { ascending: true });
  return {
    template: templateFromRow(data),
    pages: ((pages as any[] | null) ?? []).map((p) => ({
      ...(p as DaAgreementTemplatePage),
      page_name: p.da_page_template?.name ?? '—',
    })),
  };
}

export type TemplateFieldMapping = {
  template: DaAgreementTemplate;
  fields: MappedField[];
  summary: ReturnType<typeof mappingSummary>;
  sampleRecipient: { id: string; full_name: string } | null;
};

/**
 * What auto-mapping would do for every template, resolved against a real
 * recipient when one exists so the preview shows values rather than labels.
 */
export async function listTemplateFieldMappings(): Promise<TemplateFieldMapping[]> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return [];

  const [templates, settings, overrides] = await Promise.all([
    listAgreementTemplates(),
    getSettings(),
    loadFieldOverrides(supabase),
  ]);

  const { data: recipients } = await supabase
    .from('da_recipient')
    .select('id, full_name, email, phone, business_name, recipient_type')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(50);
  const pool =
    (recipients as
      | (Pick<DaRecipient, 'id' | 'full_name' | 'email' | 'phone' | 'business_name' | 'recipient_type'>[])
      | null) ?? [];

  const out: TemplateFieldMapping[] = [];
  for (const template of templates) {
    const recipient = pool.find((r) => r.recipient_type === template.recipient_type) ?? pool[0] ?? null;
    const submitted = recipient ? await loadSubmittedValues(supabase, recipient.id) : {};
    const profile = recipient
      ? buildProfile({ recipient, submitted, bookingUrl: settings?.default_booking_url })
      : {};

    const { data: pages } = await supabase
      .from('da_agreement_template_page')
      .select('docuseal_field_name')
      .eq('agreement_template_id', template.id);
    const pageUrls: Record<string, string> = {};
    for (const page of (pages as { docuseal_field_name: string }[] | null) ?? []) {
      pageUrls[page.docuseal_field_name] = `${settings?.public_base_url ?? ''}/p/…`;
    }

    const fields = mapFields(template.docuseal_fields, {
      profile,
      submitted,
      pageUrls,
      overrides: overridesFor(overrides, template.id),
    });

    out.push({
      template,
      fields,
      summary: mappingSummary(fields),
      sampleRecipient: recipient ? { id: recipient.id, full_name: recipient.full_name } : null,
    });
  }

  return out;
}

export async function listAgreements(filters?: {
  status?: AgreementStatus | 'all';
  recipientType?: RecipientType | 'all';
}): Promise<
  (DaAgreement & { recipient_name: string; recipient_type: RecipientType; template_name: string })[]
> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return [];

  let query = supabase
    .from('da_agreement')
    .select('*, da_recipient(full_name, recipient_type), da_agreement_template(name)')
    .is('superseded_by_id', null)
    .order('sent_at', { ascending: false });

  if (filters?.status && filters.status !== 'all') query = query.eq('status', filters.status);

  const { data } = await query;
  let rows = ((data as any[] | null) ?? []).map((row) => ({
    ...(row as DaAgreement),
    recipient_name: row.da_recipient?.full_name ?? '—',
    recipient_type: (row.da_recipient?.recipient_type ?? 'client') as RecipientType,
    template_name: row.da_agreement_template?.name ?? '—',
  }));

  if (filters?.recipientType && filters.recipientType !== 'all') {
    rows = rows.filter((r) => r.recipient_type === filters.recipientType);
  }

  return rows;
}

export async function getAgreement(id: string): Promise<DaAgreement | null> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return null;
  const { data } = await supabase.from('da_agreement').select('*').eq('id', id).maybeSingle();
  return (data as DaAgreement | null) ?? null;
}

export async function listCalendarLinks(): Promise<
  (DaCalendarLink & { recipient_name: string })[]
> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return [];
  const { data } = await supabase
    .from('da_calendar_link')
    .select('*, da_recipient(full_name)')
    .order('created_at', { ascending: false });
  return ((data as any[] | null) ?? []).map((row) => ({
    ...(row as DaCalendarLink),
    recipient_name: row.da_recipient?.full_name ?? '—',
  }));
}

export async function listPageTokensForTemplate(pageTemplateId: string): Promise<
  (DaPageToken & { recipient_name: string })[]
> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return [];
  const { data } = await supabase
    .from('da_page_token')
    .select('*, da_recipient(full_name)')
    .eq('page_template_id', pageTemplateId)
    .order('created_at', { ascending: false });
  return ((data as any[] | null) ?? []).map((row) => ({
    ...(row as DaPageToken),
    resolved_values: (row.resolved_values ?? {}) as Record<string, string>,
    recipient_name: row.da_recipient?.full_name ?? '—',
  }));
}
