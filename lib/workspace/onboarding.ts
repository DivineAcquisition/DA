import {
  getOnboardingProtocol,
  validateOnboardingAnswers,
  type OnboardingProtocol,
} from './onboarding-protocol';
import { publicDaRpc } from './resolve-signing';

export type OnboardingPagePayload = {
  token: string;
  protocol: OnboardingProtocol;
  recipientName: string;
  recipientEmail: string;
  recipientPhone: string | null;
  agreementSigned: boolean;
  agreementTemplateName: string | null;
  completed: boolean;
  answers: Record<string, string>;
};

type LoadedBundle = {
  submission: {
    id: string;
    protocol_key: string;
    status: string;
    answers: Record<string, string>;
    completed_at: string | null;
    agreement_id: string | null;
  };
  recipient: {
    full_name: string;
    email: string;
    phone: string | null;
  };
  agreement: {
    id: string;
    status: string;
    template_name: string;
    signed: boolean;
  } | null;
};

export async function loadOnboardingPage(token: string): Promise<OnboardingPagePayload | null> {
  if (token.trim().length < 32) return null;
  const data = await publicDaRpc<LoadedBundle>('da_load_onboarding', {
    p_token: token.trim(),
  });
  if (!data?.submission || !data.recipient) return null;

  const protocol = getOnboardingProtocol(data.submission.protocol_key);
  if (!protocol) return null;

  const answers = (data.submission.answers ?? {}) as Record<string, string>;

  return {
    token: token.trim(),
    protocol,
    recipientName: data.recipient.full_name,
    recipientEmail: data.recipient.email,
    recipientPhone: data.recipient.phone,
    agreementSigned: Boolean(data.agreement?.signed),
    agreementTemplateName: data.agreement?.template_name ?? null,
    completed: data.submission.status === 'completed',
    answers,
  };
}

export async function submitOnboarding(input: {
  token: string;
  answers: Record<string, string>;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const page = await loadOnboardingPage(input.token);
  if (!page) return { ok: false, error: 'This link is no longer available.' };
  if (page.completed) return { ok: true };
  if (!page.agreementSigned) {
    return {
      ok: false,
      error: 'Sign your agreement first, then return here to complete onboarding.',
    };
  }

  const validated = validateOnboardingAnswers(page.protocol, input.answers);
  if (!validated.ok) return validated;

  try {
    const marked = await publicDaRpc<boolean>(
      'da_submit_onboarding',
      {
        p_token: input.token.trim(),
        p_answers: input.answers,
      },
      (value) => value === true,
    );
    if (!marked) {
      return { ok: false, error: 'Could not save your onboarding answers. Try again.' };
    }
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not save onboarding.';
    return { ok: false, error: message.replace(/^agreement_unsigned:\s*/i, '') };
  }
}
