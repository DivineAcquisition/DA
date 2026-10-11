import {
  GHL_FIELD_AD_SPEND,
  GHL_FIELD_COMPANY_NAME,
  GHL_FIELD_FOLLOW_UP,
  GHL_FIELD_PROGRAM_PRICE,
  GHL_FIELD_QUAL_RESULT,
  GHL_FIELD_READINESS,
} from './config';
import { GHL_FIELDS_TO_CREATE, nicheGhlValues } from './niche-lead';
import type { QualificationPayload, QualificationResult } from './qualify';
import type { LeadStage } from './stages';

type FieldSpec = {
  key: string;
  /** The name to create on the GHL location. */
  name: string;
  /** Names already in use that count as the same field. */
  aliases: readonly string[];
  /** The ClientAcquisition Leads column that holds the same value, when there is one. */
  airtable?: string;
  /** Env var that pins the GHL field id instead of matching by name. */
  envId?: string;
};

/**
 * One map for every DA value kept on a GHL contact. A value is only written
 * when the field exists on the location, so a missing field never blocks a lead.
 */
export const GHL_CONTACT_FIELDS = [
  { key: 'companyName', name: 'DA - Company Name', aliases: ['Company Name', 'company_name'], airtable: 'Company Name', envId: GHL_FIELD_COMPANY_NAME },
  { key: 'offer', name: 'DA - Offer', aliases: ['DA - Coaching Niche', 'Coaching Niche', 'Offer'], airtable: 'Coaching Niche' },
  { key: 'adSpend', name: 'DA - Monthly Ad Spend', aliases: ['Monthly Ad Spend', 'monthly_ad_spend', 'da_monthly_ad_spend'], airtable: 'Monthly Ad Spend', envId: GHL_FIELD_AD_SPEND },
  { key: 'followUp', name: 'DA - Follow-Up Owner', aliases: ['Follow-Up Owner', 'follow_up_owner', 'da_follow_up_owner'], airtable: 'Follow-Up Owner', envId: GHL_FIELD_FOLLOW_UP },
  { key: 'programPrice', name: 'DA - Program Price', aliases: ['Program Price', 'program_price', 'da_program_price'], airtable: 'Program Price', envId: GHL_FIELD_PROGRAM_PRICE },
  { key: 'inquiries', name: 'DA - Inquiries Per Month', aliases: ['Inquiries Per Month', 'Inquiries', 'inquiries_per_month', 'da_inquiries_per_month'] },
  { key: 'readiness', name: 'DA - Readiness Score', aliases: ['Readiness Score', 'readiness_score', 'da_readiness_score'], envId: GHL_FIELD_READINESS },
  { key: 'qualification', name: 'DA - Qualification Result', aliases: ['Qualification Result', 'qualification_result', 'da_qualification_result'], airtable: 'Qualification Result', envId: GHL_FIELD_QUAL_RESULT },
  { key: 'stage', name: 'DA - Lead Stage', aliases: ['Lead Stage', 'DA - Stage'], airtable: 'Stage' },
  { key: 'leadSource', name: 'DA - Lead Source', aliases: ['Lead Source', 'lead_source'], airtable: 'Lead Source' },
  { key: 'entryPoint', name: 'DA - Entry Point', aliases: ['Entry Point', 'entry_point'], airtable: 'Entry Point' },
  { key: 'smsConsent', name: 'DA - SMS Consent', aliases: ['SMS Consent'] },
  { key: 'smsConsentVersion', name: 'DA - SMS Consent Wording', aliases: ['SMS Consent Wording'] },
  { key: 'appointmentStatus', name: 'DA - Appointment Status', aliases: ['Appointment Status'] },
  { key: 'auditDate', name: 'DA - Audit Booked Date', aliases: ['Audit Booked Date', 'Audit Date'], airtable: 'Audit Booked Date' },
  { key: 'meetingLink', name: 'DA - Meeting Link', aliases: ['Meeting Link', 'Google Meet URL'], airtable: 'Google Meet URL' },
  { key: 'workspaceLeadId', name: 'DA - Workspace Lead ID', aliases: ['Workspace Lead ID'] },
  { key: 'airtableRecordId', name: 'DA - Airtable Record ID', aliases: ['Airtable Record ID'] },
  ...GHL_FIELDS_TO_CREATE,
] as const satisfies readonly FieldSpec[];

export type GhlFieldKey = (typeof GHL_CONTACT_FIELDS)[number]['key'];

export type GhlFieldValues = Partial<Record<GhlFieldKey, string | number | null | undefined>>;

/** Everything an application knows, keyed by field. */
export function applicationFieldValues(
  payload: QualificationPayload,
  extras: { stage?: LeadStage; workspaceLeadId?: string; smsConsentVersion?: string | null } = {},
): GhlFieldValues {
  return {
    companyName: payload.companyName,
    offer: payload.coachingNiche,
    adSpend: payload.monthlyAdSpend,
    followUp: payload.followUpOwner,
    programPrice: payload.programPrice,
    inquiries: payload.inquiriesPerMonth,
    stage: extras.stage,
    leadSource: payload.leadSource,
    entryPoint: payload.entryPoint,
    smsConsent: payload.smsConsent ? 'Yes' : 'No',
    smsConsentVersion: payload.smsConsent ? extras.smsConsentVersion : null,
    workspaceLeadId: extras.workspaceLeadId,
    ...nicheGhlValues(payload),
  };
}

export function scoreFieldValues(score: {
  readinessScore: number | null;
  qualificationResult: QualificationResult | null;
}): GhlFieldValues {
  return { readiness: score.readinessScore, qualification: score.qualificationResult };
}
