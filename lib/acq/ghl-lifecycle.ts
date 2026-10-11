import type { BookingStatus } from '@/lib/booking-messages/types';
import { redact } from '@/lib/ghl/rules';
import { APPOINTMENT_TAGS, STAGE_TAGS, exclusiveTagChange } from '@/lib/ghl/tags';
import { ghlPitSync } from '@/lib/ghl/pit';
import { ACQ_GHL_LOCATION_ID, ACQ_GHL_PIPELINE_ID, ACQ_GHL_PIPELINE_NAME } from './config';
import type { GhlFieldValues } from './ghl-fields';
import {
  addGhlTags,
  customFieldEntries,
  ghlReady,
  ghlFetch,
  removeGhlTags,
  resolveGhlCustomFields,
} from './pipeline';
import { opportunityStatus, type LeadStage } from './stages';

export type GhlPipeline = { id: string; name: string; stages: Array<{ id: string; name: string }> };

/** Pipeline stage names DA's stages also answer to, so an existing pipeline maps without renames. */
const STAGE_ALIASES: Record<LeadStage, string[]> = {
  'Step 1 Captured': ['New Lead', 'New', 'Lead', 'Captured', 'Lead New'],
  'Application Abandoned': ['Abandoned', 'Application Started'],
  'Manual Review': ['Review', 'Needs Review'],
  'Qualified - Not Booked': ['Qualified', 'Qualified Not Booked'],
  'Audit Booked': ['Booked', 'Appointment Booked', 'Call Booked', 'Audit Scheduled'],
  'No Show': ['No-Show', 'Noshow', 'Missed'],
  'Audit Held': ['Showed', 'Held', 'Call Held', 'Audit Completed'],
  'Closed Won': ['Won', 'Closed - Won'],
  'Closed Lost': ['Lost', 'Closed - Lost'],
  Disqualified: ['DQ', 'Unqualified', 'Not Qualified'],
  Recycled: ['Nurture', 'Recycle'],
};

const key = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '');

export function pickPipeline(pipelines: GhlPipeline[], wanted: { id?: string; name?: string }): GhlPipeline | null {
  if (wanted.id) return pipelines.find((pipeline) => pipeline.id === wanted.id) ?? null;
  if (wanted.name) {
    const byName = pipelines.find((pipeline) => key(pipeline.name) === key(wanted.name ?? ''));
    if (byName) return byName;
  }
  return null;
}

export function pipelineStageId(pipeline: GhlPipeline, stage: LeadStage): string | null {
  const names = [stage, ...STAGE_ALIASES[stage]].map(key);
  for (const name of names) {
    const found = pipeline.stages.find((item) => key(item.name) === name);
    if (found) return found.id;
  }
  return null;
}

let pipelineCache: { at: number; pipeline: GhlPipeline | null } | null = null;

export function forgetGhlPipeline(): void {
  pipelineCache = null;
}

async function leadPipeline(): Promise<GhlPipeline | null> {
  if (pipelineCache && Date.now() - pipelineCache.at < 10 * 60 * 1000) return pipelineCache.pipeline;
  const data = await ghlFetch<{ pipelines?: GhlPipeline[] }>(
    `/opportunities/pipelines?locationId=${encodeURIComponent(ACQ_GHL_LOCATION_ID)}`,
    { method: 'GET' },
    'ghl-pipeline',
  );
  const pipeline = pickPipeline(data.pipelines ?? [], { id: ACQ_GHL_PIPELINE_ID, name: ACQ_GHL_PIPELINE_NAME });
  pipelineCache = { at: Date.now(), pipeline };
  return pipeline;
}

async function moveOpportunity(contactId: string, stage: LeadStage, name: string): Promise<void> {
  const pipeline = await leadPipeline();
  if (!pipeline) {
    console.error('[acq:ghl-opportunity] no lead pipeline on the location; run Build in GHL from Workspace settings');
    return;
  }
  const stageId = pipelineStageId(pipeline, stage);
  if (!stageId) {
    console.error('[acq:ghl-opportunity] pipeline has no stage for', stage);
    return;
  }
  const status = opportunityStatus(stage);
  const found = await ghlFetch<{ opportunities?: Array<{ id?: string; pipelineId?: string }> }>(
    `/opportunities/search?location_id=${encodeURIComponent(ACQ_GHL_LOCATION_ID)}&contact_id=${encodeURIComponent(contactId)}&pipeline_id=${encodeURIComponent(pipeline.id)}&limit=1`,
    { method: 'GET' },
    'ghl-opportunity',
  );
  const existing = (found.opportunities ?? []).find((item) => item.id);
  if (existing?.id) {
    await ghlFetch(
      `/opportunities/${existing.id}`,
      { method: 'PUT', body: JSON.stringify({ pipelineId: pipeline.id, pipelineStageId: stageId, status }) },
      'ghl-opportunity',
    );
    return;
  }
  await ghlFetch(
    '/opportunities/',
    {
      method: 'POST',
      body: JSON.stringify({
        locationId: ACQ_GHL_LOCATION_ID,
        pipelineId: pipeline.id,
        pipelineStageId: stageId,
        contactId,
        name,
        status,
      }),
    },
    'ghl-opportunity',
  );
}

/**
 * Puts a GHL contact where the lead is: one `lead - ...` tag, one
 * `appointment - ...` tag when a booking changed, the stage fields, and the
 * opportunity in the lead pipeline. Each part is tried on its own and never throws.
 */
export async function moveGhlLead(input: {
  contactId: string;
  stage: LeadStage | null;
  name: string;
  appointment?: BookingStatus;
  fields?: GhlFieldValues;
}): Promise<void> {
  if (!input.contactId || !(await ghlReady())) return;
  const step = async (label: string, run: () => Promise<void>) => {
    try {
      await run();
    } catch (error) {
      console.error(`[acq:${label}]`, redact(error instanceof Error ? error.message : String(error), [ghlPitSync()]));
    }
  };

  const changes = [
    input.stage ? exclusiveTagChange(STAGE_TAGS, STAGE_TAGS[input.stage]) : null,
    input.appointment ? exclusiveTagChange(APPOINTMENT_TAGS, APPOINTMENT_TAGS[input.appointment]) : null,
  ].filter((change): change is NonNullable<typeof change> => change !== null);
  await step('ghl-lead-tags', async () => {
    for (const change of changes) {
      await removeGhlTags(input.contactId, change.remove, 'ghl-lead-tags');
      await addGhlTags(input.contactId, change.add, 'ghl-lead-tags');
    }
  });

  const values: GhlFieldValues = { ...input.fields };
  if (input.stage) values.stage = input.stage;
  if (input.appointment) values.appointmentStatus = input.appointment.replace('_', ' ');
  await step('ghl-lead-fields', async () => {
    const entries = customFieldEntries(await resolveGhlCustomFields(), values);
    if (!entries.length) return;
    await ghlFetch(
      `/contacts/${input.contactId}`,
      { method: 'PUT', body: JSON.stringify({ customFields: entries }) },
      'ghl-lead-fields',
    );
  });

  const stage = input.stage;
  if (stage) {
    await step('ghl-opportunity', () => moveOpportunity(input.contactId, stage, input.name || 'Lead'));
  }
}
