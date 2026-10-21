'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin, workspaceClient } from './db';
import { MARKET_SLUG, isOfferLine, isPipelineStage, isTouchChannel, marketSlug } from './pipeline';
import type { ActionResult } from './types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

function revalidateLead(id: string) {
  revalidatePath('/workspace/pipeline');
  revalidatePath(`/workspace/pipeline/${id}`);
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Offer line and market together: a local lead needs a market, coaching has none. */
function offerFields(formData: FormData): { offer_line: string; market: string | null } | { error: string } {
  const line = field(formData, 'offer_line');
  if (!isOfferLine(line)) return { error: 'Pick Coaching or Local markets.' };
  if (line === 'coaching') return { offer_line: line, market: null };
  const market = field(formData, 'market');
  if (!MARKET_SLUG.test(market)) return { error: 'Pick the market for a local lead.' };
  return { offer_line: line, market };
}

/** Stage, owner, and next step. Stage and owner changes log themselves to the timeline. */
export async function updatePipelineLeadAction(formData: FormData): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!session) return { ok: false, error: 'Sign in as an admin to change leads.' };

  const id = field(formData, 'id');
  if (!UUID.test(id)) return { ok: false, error: 'Lead not found.' };

  const stage = field(formData, 'stage');
  if (!isPipelineStage(stage)) return { ok: false, error: 'Pick a stage from the list.' };

  const owner = field(formData, 'owner_id');
  if (owner && !UUID.test(owner)) return { ok: false, error: 'Pick an owner from the list.' };

  const nextAction = field(formData, 'next_action');
  if (nextAction.length > 500) return { ok: false, error: 'Keep the next step under 500 characters.' };

  const offer = offerFields(formData);
  if ('error' in offer) return { ok: false, error: offer.error };

  const supabase = await workspaceClient();
  if (!supabase) return { ok: false, error: 'The database is not configured.' };

  const { error } = await supabase
    .from('da_leads')
    .update({ stage, owner_id: owner || null, next_action: nextAction, ...offer })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };

  revalidateLead(id);
  return { ok: true, message: 'Lead saved.' };
}

/** A note, or a touch (call, text, email, DM) that counts toward speed to contact. */
export async function logPipelineEventAction(formData: FormData): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!session) return { ok: false, error: 'Sign in as an admin to log activity.' };

  const id = field(formData, 'id');
  if (!UUID.test(id)) return { ok: false, error: 'Lead not found.' };

  const kind = field(formData, 'kind');
  if (kind !== 'note' && kind !== 'touch') return { ok: false, error: 'Choose a note or a touch.' };

  const channel = field(formData, 'channel');
  if (kind === 'touch' && !isTouchChannel(channel)) return { ok: false, error: 'Pick how you reached them.' };

  const body = field(formData, 'body');
  if (kind === 'note' && !body) return { ok: false, error: 'Write the note first.' };
  if (body.length > 4000) return { ok: false, error: 'Keep it under 4,000 characters.' };

  const supabase = await workspaceClient();
  if (!supabase) return { ok: false, error: 'The database is not configured.' };

  const { error } = await supabase.from('da_lead_events').insert({
    lead_id: id,
    actor_id: session.userId,
    kind,
    channel: kind === 'touch' ? channel : null,
    body,
  });
  if (error) return { ok: false, error: error.message };

  revalidateLead(id);
  return { ok: true, message: kind === 'touch' ? 'Touch logged.' : 'Note added.' };
}

/** A lead from outbound, a referral, or a market with no funnel yet. */
export async function createPipelineLeadAction(formData: FormData): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!session) return { ok: false, error: 'Sign in as an admin to add leads.' };

  const fullName = field(formData, 'full_name');
  if (fullName.length < 2 || fullName.length > 200) return { ok: false, error: 'Enter the contact name.' };

  const email = field(formData, 'email').toLowerCase();
  if (email && (!EMAIL.test(email) || email.length > 320)) return { ok: false, error: 'Check the email address.' };

  const phone = field(formData, 'phone');
  if (phone.length > 40) return { ok: false, error: 'Check the phone number.' };
  if (!email && !phone) return { ok: false, error: 'Add an email or a phone number.' };

  const company = field(formData, 'company_name');
  if (company.length > 200) return { ok: false, error: 'Shorten the business name.' };

  const trade = field(formData, 'trade');
  if (trade.length > 80) return { ok: false, error: 'Shorten the specialty.' };

  const source = field(formData, 'source');
  if (source.length > 120) return { ok: false, error: 'Shorten the source.' };

  const owner = field(formData, 'owner_id');
  if (owner && !UUID.test(owner)) return { ok: false, error: 'Pick an owner from the list.' };

  const offer = offerFields(formData);
  if ('error' in offer) return { ok: false, error: offer.error };

  const supabase = await workspaceClient();
  if (!supabase) return { ok: false, error: 'The database is not configured.' };

  const { data, error } = await supabase
    .from('da_leads')
    .insert({
      full_name: fullName,
      email,
      phone,
      company_name: company,
      stage: 'Step 1 Captured',
      owner_id: owner || null,
      ...offer,
      payload: { origin: 'workspace', ...(source ? { source } : {}), ...(trade ? { trade } : {}) },
    })
    .select('id')
    .single();
  if (error) {
    if (error.code === '23505') return { ok: false, error: 'A lead with that email is already in the pipeline.' };
    return { ok: false, error: error.message };
  }

  const id = String(data.id);
  revalidateLead(id);
  return { ok: true, message: 'Lead added.', data: { id } };
}

/** A new local market, e.g. "Med spa" or "Roofing". */
export async function addMarketAction(formData: FormData): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!session) return { ok: false, error: 'Sign in as an admin to add markets.' };

  const label = field(formData, 'label');
  if (label.length < 2 || label.length > 60) return { ok: false, error: 'Name the market in 2 to 60 characters.' };
  const slug = marketSlug(label);
  if (!slug) return { ok: false, error: 'Start the market name with a letter.' };

  const supabase = await workspaceClient();
  if (!supabase) return { ok: false, error: 'The database is not configured.' };

  const { error } = await supabase.from('da_markets').insert({ slug, label });
  if (error) {
    if (error.code === '23505') return { ok: false, error: 'That market is already on the list.' };
    return { ok: false, error: error.message };
  }

  revalidatePath('/workspace/pipeline');
  return { ok: true, message: `${label} added.` };
}

/** Hide a market from new leads and the toggle without touching its leads. */
export async function setMarketActiveAction(formData: FormData): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!session) return { ok: false, error: 'Sign in as an admin to change markets.' };

  const slug = field(formData, 'slug');
  if (!MARKET_SLUG.test(slug)) return { ok: false, error: 'Market not found.' };
  const active = field(formData, 'active') === 'true';

  const supabase = await workspaceClient();
  if (!supabase) return { ok: false, error: 'The database is not configured.' };

  const { error } = await supabase.from('da_markets').update({ active }).eq('slug', slug);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/workspace/pipeline');
  return { ok: true, message: active ? 'Market shown.' : 'Market hidden.' };
}
