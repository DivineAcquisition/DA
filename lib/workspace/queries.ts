import { requireAdmin, workspaceClient } from './db';
import type {
  DaAgreement,
  DaAgreementTemplate,
  DaAgreementTemplatePage,
  DaCalendarLink,
  DaPageTemplate,
  DaPageToken,
  DaRecipient,
  DaSettings,
  RecipientStatus,
  RecipientType,
  AgreementStatus,
} from './types';

export async function getSettings(): Promise<DaSettings | null> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return null;
  const { data } = await supabase.from('da_settings').select('*').eq('id', 1).maybeSingle();
  return (data as DaSettings | null) ?? null;
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
  return ((data as any[] | null) ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    recipient_type: row.recipient_type,
    docuseal_template_id: row.docuseal_template_id,
    created_at: row.created_at,
    page_count: Array.isArray(row.da_agreement_template_page)
      ? row.da_agreement_template_page.length
      : 0,
  }));
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
    template: data as DaAgreementTemplate,
    pages: ((pages as any[] | null) ?? []).map((p) => ({
      ...(p as DaAgreementTemplatePage),
      page_name: p.da_page_template?.name ?? '—',
    })),
  };
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
