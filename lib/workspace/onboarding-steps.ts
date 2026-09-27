/**
 * Onboarding steps as the page renders them, plus the pure rules the page
 * needs to lay them out. The database decides what counts at save and finish
 * time (da_onboarding_save_step / da_onboarding_finish); these mirror those
 * rules so the page can show progress and point at what is missing.
 */

export type OnboardingStepKind = 'form_question' | 'acknowledgment' | 'credential_handoff' | 'material_review';

export type OnboardingStep = {
  key: string;
  label: string;
  kind: OnboardingStepKind;
  help: string | null;
  required: boolean;
  section_key: string | null;
  section_title: string | null;
  section_intro: string | null;
  input_type: 'text' | 'email' | 'phone' | 'textarea' | 'select' | 'single_select' | null;
  placeholder: string | null;
  choices: Array<{ value: string; label: string }> | null;
  show_when: { step: string; values: string[] } | null;
  link_url: string | null;
  link_label: string | null;
  prefill: 'recipient_name' | 'recipient_first_name' | 'recipient_email' | 'recipient_phone' | null;
  no_paste: boolean;
  tools: string[] | null;
  asset: { title: string; description: string | null; url: string | null } | null;
};

/** One saved answer, keyed by step in da_onboarding_submission.answers. */
export type OnboardingAnswer = {
  kind?: OnboardingStepKind;
  label?: string;
  value?: string;
  answered_at?: string;
  confirmed_at?: string;
  access?: 'received' | 'not_received';
  at?: string;
  tools?: string[] | null;
  asset_id?: string;
  opened_at?: string;
};

export type StepGroup = { key: string; title: string | null; intro: string | null; steps: OnboardingStep[] };

export function isVisible(step: OnboardingStep, answers: Record<string, OnboardingAnswer>): boolean {
  if (!step.show_when) return true;
  return step.show_when.values.includes(answers[step.show_when.step]?.value ?? '');
}

export function isDone(step: OnboardingStep, answer: OnboardingAnswer | undefined): boolean {
  if (!answer) return false;
  switch (step.kind) {
    case 'form_question':
      return Boolean(answer.value?.trim());
    case 'acknowledgment':
      return Boolean(answer.confirmed_at);
    case 'credential_handoff':
      return answer.access === 'received' || answer.access === 'not_received';
    case 'material_review':
      return Boolean(answer.confirmed_at);
  }
}

/**
 * Screens for a phone: steps that share a section are one screen; a step
 * with no section is a screen of its own.
 */
export function groupSteps(steps: OnboardingStep[]): StepGroup[] {
  const groups: StepGroup[] = [];
  for (const step of steps) {
    const last = groups[groups.length - 1];
    if (step.section_key && last && last.key === `section:${step.section_key}`) {
      last.steps.push(step);
    } else {
      groups.push({
        key: step.section_key ? `section:${step.section_key}` : `step:${step.key}`,
        title: step.section_title,
        intro: step.section_intro,
        steps: [step],
      });
    }
  }
  return groups;
}

/** Done out of total, over the steps currently shown. */
export function progress(steps: OnboardingStep[], answers: Record<string, OnboardingAnswer>) {
  const shown = steps.filter((step) => isVisible(step, answers));
  return { done: shown.filter((step) => isDone(step, answers[step.key])).length, total: shown.length };
}

/** The first shown, required step without an answer, in order. */
export function firstMissing(
  steps: OnboardingStep[],
  answers: Record<string, OnboardingAnswer>,
): OnboardingStep | null {
  return steps.find((step) => step.required && isVisible(step, answers) && !isDone(step, answers[step.key])) ?? null;
}
