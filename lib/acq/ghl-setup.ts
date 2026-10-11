import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { redact } from '@/lib/ghl/rules';
import { ghlPit, ghlPitSource } from '@/lib/ghl/pit';
import {
  APPOINTMENT_TAGS,
  LEGACY_TAGS,
  QUALIFICATION_TAGS,
  SOURCE_TAGS,
  SPEND_QUALIFIED_TAGS,
  STAGE_TAGS,
  TAGS,
  exclusiveTagChange,
} from '@/lib/ghl/tags';
import { ACQ_GHL_LOCATION_ID, ACQ_GHL_PIPELINE_ID, ACQ_GHL_PIPELINE_NAME } from './config';
import { GHL_CONTACT_FIELDS } from './ghl-fields';
import { forgetGhlPipeline, moveGhlLead, pickPipeline, pipelineStageId, type GhlPipeline } from './ghl-lifecycle';
import { addGhlTags, forgetGhlCustomFields, removeGhlTags } from './pipeline';
import { isLeadStage, LEAD_STAGES } from './stages';
import type { QualificationResult } from './qualify';

const GHL_API = 'https://services.leadconnectorhq.com';

/** Every tag DA writes, so GHL workflows and filters can pick them before any contact has one. */
export function formalTags(): string[] {
  return [
    ...new Set([
      ...Object.values(STAGE_TAGS),
      ...Object.values(QUALIFICATION_TAGS),
      ...Object.values(APPOINTMENT_TAGS),
      ...Object.values(SOURCE_TAGS),
      ...Object.values(TAGS),
      ...Object.values(SPEND_QUALIFIED_TAGS),
      ...Object.values(LEGACY_TAGS),
    ]),
  ];
}

const NUMERIC_FIELDS = new Set(['readiness', 'inquiries']);

export type GhlSetupSummary = {
  token: 'env' | 'settings' | 'none';
  connected: boolean;
  tags: { renamed: string[]; created: string[]; present: number; failed: string[] };
  fields: { created: string[]; present: number; failed: string[] };
  pipeline: { name: string; created: boolean; stagesAdded: string[]; missingStages: string[]; error: string };
  leads: { synced: number; contactsCreated: number; failed: string[] };
  errors: string[];
};

type Call = { ok: boolean; status: number; data: Record<string, unknown>; error: string };

async function call(pit: string, method: string, path: string, body?: unknown, version = '2021-07-28'): Promise<Call> {
  try {
    const response = await fetch(`${GHL_API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${pit}`,
        Version: version,
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    });
    const text = await response.text();
    let data: Record<string, unknown> = {};
    try {
      data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      data = {};
    }
    const message = typeof data.message === 'string' ? data.message : Array.isArray(data.message) ? data.message.join('; ') : text;
    return {
      ok: response.ok,
      status: response.status,
      data,
      error: response.ok ? '' : redact(`${response.status} ${message}`.slice(0, 300), [pit]),
    };
  } catch (error) {
    return { ok: false, status: 0, data: {}, error: redact(error instanceof Error ? error.message : String(error), [pit]) };
  }
}

const norm = (value: string) => value.trim().toLowerCase();
const key = (value: string) => value.toLowerCase().replace(/^contact\./, '').replace(/[^a-z0-9]+/g, '');

function list<T>(data: Record<string, unknown>, field: string): T[] {
  const value = data[field];
  return Array.isArray(value) ? (value as T[]) : [];
}

async function setupTags(pit: string, summary: GhlSetupSummary) {
  const loc = encodeURIComponent(ACQ_GHL_LOCATION_ID);
  const found = await call(pit, 'GET', `/locations/${loc}/tags`);
  if (!found.ok) {
    summary.tags.failed.push(`read tags: ${found.error}`);
    return;
  }
  const tags = list<{ id?: string; name?: string }>(found.data, 'tags');
  const names = new Set(tags.map((tag) => norm(tag.name ?? '')));

  for (const [old, formal] of Object.entries(LEGACY_TAGS)) {
    const existing = tags.find((tag) => norm(tag.name ?? '') === norm(old));
    if (!existing?.id || names.has(norm(formal))) continue;
    const renamed = await call(pit, 'PUT', `/locations/${loc}/tags/${encodeURIComponent(existing.id)}`, { name: formal });
    if (renamed.ok) {
      names.delete(norm(old));
      names.add(norm(formal));
      summary.tags.renamed.push(`${old} -> ${formal}`);
    } else {
      summary.tags.failed.push(`rename ${old}: ${renamed.error}`);
    }
  }

  for (const tag of formalTags()) {
    if (names.has(norm(tag))) {
      summary.tags.present += 1;
      continue;
    }
    const created = await call(pit, 'POST', `/locations/${loc}/tags`, { name: tag });
    if (created.ok) {
      names.add(norm(tag));
      summary.tags.created.push(tag);
    } else {
      summary.tags.failed.push(`${tag}: ${created.error}`);
    }
  }
}

async function setupFields(pit: string, summary: GhlSetupSummary) {
  const loc = encodeURIComponent(ACQ_GHL_LOCATION_ID);
  const found = await call(pit, 'GET', `/locations/${loc}/customFields?model=contact`);
  if (!found.ok) {
    summary.fields.failed.push(`read fields: ${found.error}`);
    return;
  }
  const fields = list<{ name?: string; fieldKey?: string }>(found.data, 'customFields');
  const keys = new Set(fields.flatMap((field) => [key(field.name ?? ''), key(field.fieldKey ?? '')]).filter(Boolean));
  for (const spec of GHL_CONTACT_FIELDS) {
    if ([spec.name, ...spec.aliases].some((name) => keys.has(key(name)))) {
      summary.fields.present += 1;
      continue;
    }
    const created = await call(pit, 'POST', `/locations/${loc}/customFields`, {
      name: spec.name,
      dataType: NUMERIC_FIELDS.has(spec.key) ? 'NUMERICAL' : 'TEXT',
      model: 'contact',
    });
    if (created.ok) {
      keys.add(key(spec.name));
      summary.fields.created.push(spec.name);
    } else {
      summary.fields.failed.push(`${spec.name}: ${created.error}`);
    }
  }
  forgetGhlCustomFields();
}

async function setupPipeline(pit: string, summary: GhlSetupSummary) {
  const loc = encodeURIComponent(ACQ_GHL_LOCATION_ID);
  const found = await call(pit, 'GET', `/opportunities/pipelines?locationId=${loc}`);
  if (!found.ok) {
    summary.pipeline.error = `read pipelines: ${found.error}`;
    return;
  }
  const pipelines = list<GhlPipeline>(found.data, 'pipelines');
  const existing = pickPipeline(pipelines, { id: ACQ_GHL_PIPELINE_ID, name: ACQ_GHL_PIPELINE_NAME });

  if (!existing) {
    const stages = LEAD_STAGES.map((name, index) => ({ name, position: index + 1 }));
    let created = await call(pit, 'POST', '/opportunities/pipelines', { locationId: ACQ_GHL_LOCATION_ID, name: ACQ_GHL_PIPELINE_NAME, stages }, 'v3');
    if (!created.ok) {
      created = await call(pit, 'POST', '/opportunities/pipelines', { locationId: ACQ_GHL_LOCATION_ID, name: ACQ_GHL_PIPELINE_NAME, stages });
    }
    summary.pipeline.name = ACQ_GHL_PIPELINE_NAME;
    if (created.ok) {
      summary.pipeline.created = true;
    } else {
      summary.pipeline.error = `create pipeline: ${created.error}`;
      summary.pipeline.missingStages = [...LEAD_STAGES];
    }
    forgetGhlPipeline();
    return;
  }

  summary.pipeline.name = existing.name;
  const missing = LEAD_STAGES.filter((stage) => !pipelineStageId(existing, stage));
  if (missing.length) {
    const stages = [
      ...existing.stages.map((stage, index) => ({ id: stage.id, name: stage.name, position: index + 1 })),
      ...missing.map((name, index) => ({ name, position: existing.stages.length + index + 1 })),
    ];
    const updated = await call(pit, 'PUT', `/opportunities/pipelines/${encodeURIComponent(existing.id)}`, { name: existing.name, stages }, 'v3');
    if (updated.ok) {
      summary.pipeline.stagesAdded = missing;
    } else {
      summary.pipeline.missingStages = missing;
      summary.pipeline.error = `add stages: ${updated.error}`;
    }
  }
  forgetGhlPipeline();
}

type LeadRow = {
  id: string;
  email: string;
  phone: string | null;
  full_name: string | null;
  company_name: string | null;
  stage: string;
  qualification_result: QualificationResult | null;
  ghl_contact_id: string | null;
  meet_url: string | null;
  audit_booked_date: string | null;
  payload: { tags?: string[]; source?: string } | null;
};

function contactIdOf(data: Record<string, unknown>): string {
  const contact = data.contact as { id?: string } | undefined;
  return contact?.id ?? (typeof data.id === 'string' ? data.id : '');
}

/** Puts every workspace lead into GHL with its tags, fields and opportunity. */
async function syncLeads(pit: string, db: SupabaseClient, summary: GhlSetupSummary) {
  const { data, error } = await db
    .from('da_leads')
    .select('id, email, phone, full_name, company_name, stage, qualification_result, ghl_contact_id, meet_url, audit_booked_date, payload')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) {
    summary.leads.failed.push(`read leads: ${error.message}`);
    return;
  }
  for (const lead of (data ?? []) as LeadRow[]) {
    let contactId = lead.ghl_contact_id?.trim() || '';
    if (!contactId) {
      const [firstName, ...rest] = (lead.full_name || lead.email).trim().split(/\s+/);
      const upserted = await call(pit, 'POST', '/contacts/upsert', {
        locationId: ACQ_GHL_LOCATION_ID,
        email: lead.email,
        phone: lead.phone || undefined,
        name: lead.full_name || undefined,
        firstName,
        lastName: rest.join(' ') || undefined,
        companyName: lead.company_name || undefined,
        source: lead.payload?.source || 'Workspace lead',
      });
      contactId = upserted.ok ? contactIdOf(upserted.data) : '';
      if (!contactId) {
        summary.leads.failed.push(`${lead.id}: ${upserted.error || 'no contact id'}`);
        continue;
      }
      summary.leads.contactsCreated += 1;
      await db.from('da_leads').update({ ghl_contact_id: contactId }).eq('id', lead.id);
    }

    const stored = (lead.payload?.tags ?? []).map((tag) => LEGACY_TAGS[norm(tag)] ?? tag);
    const add = [...new Set([...stored, TAGS.applicationComplete])];
    try {
      await addGhlTags(contactId, add, 'ghl-setup');
      if (lead.qualification_result) {
        const change = exclusiveTagChange(QUALIFICATION_TAGS, QUALIFICATION_TAGS[lead.qualification_result]);
        await removeGhlTags(contactId, change.remove, 'ghl-setup');
        await addGhlTags(contactId, change.add, 'ghl-setup');
      }
    } catch (tagError) {
      summary.leads.failed.push(`${lead.id} tags: ${redact(tagError instanceof Error ? tagError.message : String(tagError), [pit])}`);
    }
    await moveGhlLead({
      contactId,
      stage: isLeadStage(lead.stage) ? lead.stage : null,
      name: lead.company_name ? `${lead.full_name || lead.email} - ${lead.company_name}` : lead.full_name || lead.email,
      fields: {
        qualification: lead.qualification_result,
        workspaceLeadId: lead.id,
        auditDate: lead.audit_booked_date || undefined,
        meetingLink: lead.meet_url || undefined,
      },
    });
    summary.leads.synced += 1;
  }
}

function serviceDb(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim() || '';
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SECRET_KEY?.trim() || '';
  if (!url || !secret) return null;
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * Builds DA's side of the DivineACQ GHL location: renames old tags to the
 * formal names and creates the rest, creates the DA - fields, creates or
 * completes the lead pipeline, then puts every workspace lead in it. Safe to
 * run again: it only adds what is missing. The summary holds names and counts.
 */
export async function buildGhlSetup(trigger: string): Promise<GhlSetupSummary> {
  const summary: GhlSetupSummary = {
    token: await ghlPitSource(),
    connected: false,
    tags: { renamed: [], created: [], present: 0, failed: [] },
    fields: { created: [], present: 0, failed: [] },
    pipeline: { name: '', created: false, stagesAdded: [], missingStages: [], error: '' },
    leads: { synced: 0, contactsCreated: 0, failed: [] },
    errors: [],
  };
  const pit = await ghlPit();
  const db = serviceDb();

  if (!pit) {
    summary.errors.push('No GHL token. Save the DivineACQ Private Integration Token in Workspace settings.');
  } else {
    const probe = await call(pit, 'GET', `/locations/${encodeURIComponent(ACQ_GHL_LOCATION_ID)}`);
    summary.connected = probe.ok;
    if (!probe.ok) {
      summary.errors.push(`GHL rejected the token for location ${ACQ_GHL_LOCATION_ID}: ${probe.error}`);
    } else {
      await setupTags(pit, summary);
      await setupFields(pit, summary);
      await setupPipeline(pit, summary);
      if (db) await syncLeads(pit, db, summary);
    }
  }

  const ok =
    summary.connected &&
    !summary.errors.length &&
    !summary.tags.failed.length &&
    !summary.fields.failed.length &&
    !summary.pipeline.error &&
    !summary.leads.failed.length;
  if (db) {
    await db.from('ghl_setup_run').insert({ trigger, ok, summary });
  }
  return summary;
}
