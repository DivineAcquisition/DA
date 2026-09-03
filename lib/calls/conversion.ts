import { cellIds, cellText, isAirtableBaseId, parseAirtableBaseId } from './cells';
import { CLOSED_WON_OUTCOME, PAYMENT_PAID } from './config';
import { compareDatedDesc, formatShortDate, omitEmpty, todayInCallsZone } from './map';
import type {
  ClientBaseRef,
  Conversion,
  DebriefRecord,
  LeadProfile,
  LeadRecord,
  OnboardCta,
  OnboardPrefill,
  OnboardSubmitInput,
  OnboardingRecord,
} from './types';

export type { ClientBaseRef, Conversion, OnboardCta, OnboardPrefill, OnboardSubmitInput, OnboardingRecord };

export { isAirtableBaseId, parseAirtableBaseId };

export function clientBaseUrl(baseId: string): string {
  return `https://airtable.com/${baseId}`;
}

export function formatClosedWonLabel(closedWonAt: string | null): string {
  if (!closedWonAt) return CLOSED_WON_OUTCOME;
  return `${CLOSED_WON_OUTCOME} — ${formatShortDate(closedWonAt)}`;
}

export function mostRecentCompleteDebrief(debriefs: DebriefRecord[]): DebriefRecord | null {
  const complete = debriefs.filter((debrief) => debrief.complete);
  if (!complete.length) return null;
  return [...complete].sort((a, b) =>
    compareDatedDesc(
      { date: a.callDate, recordId: a.recordId },
      { date: b.callDate, recordId: b.recordId },
    ),
  )[0];
}

export function winningClosedWonDebrief(debriefs: DebriefRecord[]): DebriefRecord | null {
  const won = debriefs.filter(
    (debrief) => debrief.complete && debrief.outcome === CLOSED_WON_OUTCOME,
  );
  if (!won.length) return null;
  return [...won].sort((a, b) =>
    compareDatedDesc(
      { date: a.callDate, recordId: a.recordId },
      { date: b.callDate, recordId: b.recordId },
    ),
  )[0];
}

/** Closing debrief if there is one; otherwise the latest complete audit. */
export function prefillSourceDebrief(debriefs: DebriefRecord[]): DebriefRecord | null {
  return winningClosedWonDebrief(debriefs) ?? mostRecentCompleteDebrief(debriefs);
}

export function clientBaseFromLead(
  lead: Pick<LeadRecord, 'clientBaseId' | 'clientBaseName' | 'clientBaseCreated'>,
): ClientBaseRef | null {
  if (!isAirtableBaseId(lead.clientBaseId)) return null;
  return {
    id: lead.clientBaseId,
    name: lead.clientBaseName,
    created: lead.clientBaseCreated,
  };
}

export function conversionFrom(profile: Pick<LeadProfile, 'lead' | 'debriefs'>): Conversion {
  const winningDebrief = winningClosedWonDebrief(profile.debriefs);
  const converted = Boolean(winningDebrief) || profile.lead.stage === CLOSED_WON_OUTCOME;
  return {
    converted,
    closedWonAt: winningDebrief?.callDate || null,
    winningDebrief,
    paymentStatus: profile.lead.paymentStatus,
    paymentConfirmed: profile.lead.paymentStatus === PAYMENT_PAID,
    clientBase: clientBaseFromLead(profile.lead),
  };
}

export function onboardCta(conversion: Conversion): OnboardCta {
  if (!conversion.converted) return { kind: 'none' };
  if (conversion.clientBase) return { kind: 'client-base', base: conversion.clientBase };
  if (!conversion.paymentConfirmed) {
    return { kind: 'waiting-payment', closedWonAt: conversion.closedWonAt };
  }
  return { kind: 'start', closedWonAt: conversion.closedWonAt };
}

export function formatProgramPrice(
  lead: Pick<LeadRecord, 'programPrice'>,
  debrief: Pick<DebriefRecord, 'amountQuoted'> | null,
): { value: string; source: OnboardPrefill['programPriceSource'] } {
  if (debrief?.amountQuoted != null) {
    return {
      value: `$${Math.round(debrief.amountQuoted).toLocaleString('en-US')}`,
      source: 'quote',
    };
  }
  if (lead.programPrice) return { value: lead.programPrice, source: 'application' };
  return { value: '', source: '' };
}

const BLANK_INSTALL: Pick<
  OnboardPrefill,
  'crmAccess' | 'adminLogins' | 'databaseSize' | 'trainingSchedule'
> = {
  crmAccess: '',
  adminLogins: '',
  databaseSize: '',
  trainingSchedule: '',
};

export function onboardPrefillFrom(profile: Pick<LeadProfile, 'lead' | 'debriefs'>): OnboardPrefill {
  const debrief = prefillSourceDebrief(profile.debriefs);
  const price = formatProgramPrice(profile.lead, debrief);
  return {
    businessName: profile.lead.companyName,
    contactName: profile.lead.fullName,
    email: profile.lead.email,
    phone: profile.lead.phone,
    followUpOwner: profile.lead.followUpOwner,
    followUpHow: debrief?.currentSituation ?? '',
    programPrice: price.value,
    programPriceSource: price.source,
    decisionMakers: debrief?.decisionMakers ?? '',
    monthlyLeadVolume: profile.lead.monthlyLeadVolume,
    ...BLANK_INSTALL,
  };
}

export function onboardingTitle(leadName: string): string {
  return `${leadName.trim() || 'Lead'} — onboarding`;
}

export function onboardingWriteFields(
  input: OnboardSubmitInput & { leadName: string; submitted?: string },
): Record<string, unknown> {
  return omitEmpty({
    Onboarding: onboardingTitle(input.leadName),
    Lead: [input.leadId],
    Submitted: input.submitted ?? todayInCallsZone(),
    'Business Name': input.businessName,
    'Contact Name': input.contactName,
    Email: input.email,
    Phone: input.phone,
    'Follow-Up Owner': input.followUpOwner,
    'Follow-Up How': input.followUpHow,
    'Program Price': input.programPrice,
    'Decision Makers': input.decisionMakers,
    'Monthly Lead Volume': input.monthlyLeadVolume,
    'CRM Access': input.crmAccess,
    'Admin Logins': input.adminLogins,
    'Database Size': input.databaseSize,
    'Training Schedule': input.trainingSchedule,
  });
}

export function clientBaseWriteFields(input: {
  baseId: string;
  name: string;
  created?: string;
}): Record<string, unknown> {
  return omitEmpty({
    'Client Base ID': input.baseId,
    'Client Base Name': input.name,
    'Client Base Created': input.created ?? todayInCallsZone(),
  });
}

export function paymentPaidWriteFields(): Record<string, unknown> {
  return { 'Payment Status': PAYMENT_PAID };
}

export function mapOnboardingRecord(record: {
  id: string;
  fields?: Record<string, unknown>;
}): OnboardingRecord {
  const fields = record.fields ?? {};
  return {
    recordId: record.id,
    title: cellText(fields.Onboarding),
    submitted: cellText(fields.Submitted),
    businessName: cellText(fields['Business Name']),
    contactName: cellText(fields['Contact Name']),
    email: cellText(fields.Email),
    phone: cellText(fields.Phone),
    followUpOwner: cellText(fields['Follow-Up Owner']),
    followUpHow: cellText(fields['Follow-Up How']),
    programPrice: cellText(fields['Program Price']),
    decisionMakers: cellText(fields['Decision Makers']),
    monthlyLeadVolume: cellText(fields['Monthly Lead Volume']),
    crmAccess: cellText(fields['CRM Access']),
    adminLogins: cellText(fields['Admin Logins']),
    databaseSize: cellText(fields['Database Size']),
    trainingSchedule: cellText(fields['Training Schedule']),
    leadIds: cellIds(fields.Lead),
  };
}

export const ONBOARDING_FIELDS = [
  'Onboarding',
  'Lead',
  'Submitted',
  'Business Name',
  'Contact Name',
  'Email',
  'Phone',
  'Follow-Up Owner',
  'Follow-Up How',
  'Program Price',
  'Decision Makers',
  'Monthly Lead Volume',
  'CRM Access',
  'Admin Logins',
  'Database Size',
  'Training Schedule',
] as const;
