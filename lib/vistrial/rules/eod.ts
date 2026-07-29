import { CORE_FIELD_KEYS } from '../eodCore';
import type { CaseFileConfig, EodCore, EodReport } from '../types';

/**
 * EOD rules: one report per operator, per placement, per shift. The core block
 * is locked, the configured block varies per client, and submitted reports never
 * change in place.
 */

export type EodDraft = {
  placementId: string;
  operatorId: string;
  shiftDate: string;
  core: EodCore;
  configured: Record<string, string | number | boolean>;
};

export const emptyCore = (config: CaseFileConfig): EodCore => ({
  // Prefilled from the scheduled window as a convenience. A client with no live
  // placement has no window, so the operator types the times rather than being
  // handed a shift nobody scheduled.
  shiftStartActual: config.shiftStart ?? '',
  shiftEndActual: config.shiftEnd ?? '',
  conversationsHandled: 0,
  appointmentsBooked: 0,
  followUpsCompleted: 0,
  escalationsRaised: 0,
  blockers: '',
  notes: '',
});

export type ValidationIssue = { field: string; message: string };

export function validateEod(draft: EodDraft, config: CaseFileConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { core } = draft;

  if (!core.shiftStartActual) issues.push({ field: 'shiftStartActual', message: 'Actual shift start is required.' });
  if (!core.shiftEndActual) issues.push({ field: 'shiftEndActual', message: 'Actual shift end is required.' });

  const counters: [keyof EodCore, string][] = [
    ['conversationsHandled', 'Conversations handled'],
    ['appointmentsBooked', 'Appointments booked'],
    ['followUpsCompleted', 'Follow-ups completed'],
    ['escalationsRaised', 'Escalations raised'],
  ];

  for (const [key, label] of counters) {
    const value = core[key];
    if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
      issues.push({ field: key, message: `${label} must be zero or more.` });
    }
  }

  if (core.appointmentsBooked > core.conversationsHandled) {
    issues.push({
      field: 'appointmentsBooked',
      message: 'Appointments booked cannot exceed conversations handled.',
    });
  }

  for (const field of config.configuredFields) {
    if (!field.required) continue;
    const value = draft.configured[field.key];
    const missing =
      value === undefined ||
      value === null ||
      value === '' ||
      (field.type === 'number' && Number.isNaN(Number(value)));
    if (missing) {
      issues.push({ field: field.key, message: `${field.label} is required for this client.` });
    }
  }

  return issues;
}

/**
 * Rule 4: the core is fixed across all clients. A configured block that tried to
 * redefine a core key would silently break cross-operator reporting, so it is
 * rejected outright rather than merged.
 */
export function assertConfiguredFieldsDoNotShadowCore(config: CaseFileConfig): void {
  const collisions = config.configuredFields
    .map((field) => field.key)
    .filter((key) => CORE_FIELD_KEYS.includes(key));

  if (collisions.length > 0) {
    throw new Error(
      `Configured EOD fields may not reuse locked core keys: ${collisions.join(', ')}. The core is identical for every client.`,
    );
  }
}

/**
 * Rule 2: submitted logs are immutable. A correction is a new version, and the
 * superseded version stays visible with its timestamp, which is what makes the
 * case file usable as evidence if a client disputes what was delivered.
 */
export function correctEod(
  original: EodReport,
  draft: EodDraft,
  reason: string,
  submittedAt: string,
): { superseded: EodReport; correction: EodReport } {
  const correction: EodReport = {
    ...original,
    id: `${original.id}-v${original.version + 1}`,
    core: draft.core,
    configured: draft.configured,
    version: original.version + 1,
    submittedAt,
    supersededById: null,
    correctionReason: reason,
    adminComments: [],
  };

  return {
    superseded: { ...original, supersededById: correction.id },
    correction,
  };
}

/** The version of each report that is currently in force. */
export function currentVersions(reports: EodReport[]): EodReport[] {
  return reports.filter((report) => report.supersededById === null);
}

export function versionChain(reports: EodReport[], shiftDate: string, placementId: string): EodReport[] {
  return reports
    .filter((report) => report.shiftDate === shiftDate && report.placementId === placementId)
    .sort((a, b) => a.version - b.version);
}
