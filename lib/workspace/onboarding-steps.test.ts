import { describe, expect, it } from 'vitest';
import { firstMissing, groupSteps, isDone, progress, type OnboardingStep } from './onboarding-steps';

const base: Omit<OnboardingStep, 'key' | 'label' | 'kind'> = {
  help: null, required: true, section_key: null, section_title: null, section_intro: null, input_type: null,
  placeholder: null, choices: null, show_when: null, link_url: null, link_label: null, prefill: null,
  no_paste: false, tools: null, asset: null,
};

const steps: OnboardingStep[] = [
  { ...base, key: 'name', label: 'Name', kind: 'form_question', input_type: 'text', section_key: 'who', section_title: 'Who' },
  { ...base, key: 'avail', label: 'Available?', kind: 'form_question', input_type: 'single_select', section_key: 'who', section_title: 'Who',
    choices: [{ value: 'yes', label: 'Yes' }, { value: 'conflict', label: 'No' }] },
  { ...base, key: 'why', label: 'Why?', kind: 'form_question', input_type: 'textarea', section_key: 'who', section_title: 'Who',
    show_when: { step: 'avail', values: ['conflict'] } },
  { ...base, key: 'ack', label: 'I agree', kind: 'acknowledgment' },
  { ...base, key: 'tools', label: 'Tools', kind: 'credential_handoff', tools: ['GHL'] },
  { ...base, key: 'sop', label: 'Review SOP', kind: 'material_review' },
];

describe('onboarding steps', () => {
  it('puts a section on one screen and each unsectioned step on its own', () => {
    expect(groupSteps(steps).map((g) => g.steps.map((s) => s.key))).toEqual([
      ['name', 'avail', 'why'], ['ack'], ['tools'], ['sop'],
    ]);
  });

  it('counts only steps that are shown', () => {
    expect(progress(steps, { name: { value: 'Ana' }, avail: { value: 'yes' } })).toEqual({ done: 2, total: 5 });
    expect(progress(steps, { avail: { value: 'conflict' } }).total).toBe(6);
  });

  it('treats "no access yet" as answered and an unconfirmed review as not done', () => {
    expect(isDone(steps[4], { access: 'not_received' })).toBe(true);
    expect(isDone(steps[5], { opened_at: '2026-09-27T00:00:00Z' })).toBe(false);
  });

  it('finds the first missing required step in order', () => {
    expect(firstMissing(steps, { name: { value: 'Ana' }, avail: { value: 'yes' } })?.key).toBe('ack');
  });
});
