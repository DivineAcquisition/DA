import { publicDaRpc } from './resolve-signing';
import type { OnboardingAnswer, OnboardingStep } from './onboarding-steps';

/**
 * The public onboarding page (/o/<token>).
 *
 * Protocols and their steps come from da_onboarding_protocol /
 * da_onboarding_protocol_step only. Every answer is saved as it is given, and
 * finishing is checked by the database, so neither can be skipped from the
 * browser. Every way a token can fail is the same {"state":"invalid"}.
 */

export type OnboardingPageState =
  | { state: 'invalid' }
  | {
      state: 'sign_first';
      recipientName: string;
      protocolName: string;
      agreementToken: string | null;
      contactEmail: string | null;
    }
  | {
      state: 'completed';
      recipientName: string;
      recipientType: string;
      protocolName: string;
      completedAt: string | null;
      nextSteps: string | null;
      hasOpenAccessIssue: boolean;
      contactEmail: string | null;
    }
  | {
      state: 'open';
      recipientName: string;
      recipientType: string;
      protocolName: string;
      protocolIntro: string | null;
      prefill: Record<string, string | null>;
      answers: Record<string, OnboardingAnswer>;
      steps: OnboardingStep[];
    };

type Raw = {
  state?: string;
  recipient_name?: string;
  recipient_type?: string;
  protocol_name?: string;
  protocol_intro?: string | null;
  agreement_token?: string | null;
  contact_email?: string | null;
  completed_at?: string | null;
  next_steps?: string | null;
  has_open_access_issue?: boolean;
  prefill?: Record<string, string | null>;
  answers?: Record<string, unknown>;
  steps?: OnboardingStep[];
};

/** Only object answers in the per-step shape are kept. */
function normaliseAnswers(raw: Record<string, unknown> | undefined): Record<string, OnboardingAnswer> {
  const out: Record<string, OnboardingAnswer> = {};
  for (const [key, value] of Object.entries(raw ?? {})) {
    if (value && typeof value === 'object' && !Array.isArray(value)) out[key] = value as OnboardingAnswer;
  }
  return out;
}

export async function loadOnboardingPage(token: string, client: string | null): Promise<OnboardingPageState> {
  const raw = await publicDaRpc<Raw>('da_onboarding_page', { p_token: token, p_client: client });
  switch (raw?.state) {
    case 'sign_first':
      return {
        state: 'sign_first',
        recipientName: raw.recipient_name ?? '',
        protocolName: raw.protocol_name ?? 'Onboarding',
        agreementToken: raw.agreement_token ?? null,
        contactEmail: raw.contact_email ?? null,
      };
    case 'completed':
      return {
        state: 'completed',
        recipientName: raw.recipient_name ?? '',
        recipientType: raw.recipient_type ?? 'operator',
        protocolName: raw.protocol_name ?? 'Onboarding',
        completedAt: raw.completed_at ?? null,
        nextSteps: raw.next_steps ?? null,
        hasOpenAccessIssue: Boolean(raw.has_open_access_issue),
        contactEmail: raw.contact_email ?? null,
      };
    case 'open':
      return {
        state: 'open',
        recipientName: raw.recipient_name ?? '',
        recipientType: raw.recipient_type ?? 'operator',
        protocolName: raw.protocol_name ?? 'Onboarding',
        protocolIntro: raw.protocol_intro ?? null,
        prefill: raw.prefill ?? {},
        answers: normaliseAnswers(raw.answers),
        steps: Array.isArray(raw.steps) ? raw.steps : [],
      };
    default:
      return { state: 'invalid' };
  }
}

export type SaveResult =
  | { ok: true; step: string; answer: OnboardingAnswer | null }
  | { ok: false; error: string; step?: string; message?: string };

export type FinishResult =
  | { ok: true; completed_at: string | null }
  | { ok: false; error: string; step?: string; message?: string };

/** null means the database could not be reached, which the page reports as "not saved". */
export async function saveOnboardingStep(
  token: string,
  step: string,
  input: Record<string, unknown>,
  client: string | null,
): Promise<SaveResult | null> {
  return publicDaRpc<SaveResult>('da_onboarding_save_step', {
    p_token: token,
    p_step: step,
    p_input: input,
    p_client: client,
  });
}

export async function finishOnboarding(token: string, client: string | null): Promise<FinishResult | null> {
  return publicDaRpc<FinishResult>('da_onboarding_finish', { p_token: token, p_client: client });
}
