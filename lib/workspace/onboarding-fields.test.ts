import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import OnboardingView from '@/app/o/[token]/OnboardingView';
import {
  allowedDurations,
  endOptions,
  scheduleText,
  toggleMulti,
  weeklyLabel,
} from './onboarding-fields';
import type { OnboardingStep } from './onboarding-steps';

describe('onboarding field rules', () => {
  it('limits each day to the weekly commitment', () => {
    expect(allowedDurations('part_time_4_5')).toEqual([4, 5]);
    expect(allowedDurations('full_time_6_8')).toEqual([6, 7, 8]);
    expect(endOptions('09:00', 'part_time_4_5')).toEqual(['13:00', '14:00']);
    expect(endOptions('09:00', 'full_time_6_8')).toEqual(['15:00', '16:00', '17:00']);
    expect(endOptions('20:00', 'full_time_6_8')).toEqual([]);
  });

  it('prints a schedule and keeps no preference exclusive', () => {
    expect(weeklyLabel('part_time_4_5')).toContain('4 to 5');
    expect(scheduleText('{"days":[{"day":"mon","start":"09:00","end":"13:00"}]}')).toBe('Mon 09:00-13:00');
    expect(toggleMulti('med_spa', 'no_preference', 'no_preference')).toBe('no_preference');
    expect(toggleMulti('no_preference', 'home_services', 'no_preference')).toBe('home_services');
    expect(toggleMulti('hvac', 'med_spa')).toBe('hvac,med_spa');
  });
});

const step = (partial: Partial<OnboardingStep> & Pick<OnboardingStep, 'key' | 'label' | 'kind'>): OnboardingStep => ({
  help: null,
  required: true,
  section_key: 'account',
  section_title: 'Account',
  section_intro: null,
  input_type: null,
  placeholder: null,
  choices: null,
  show_when: null,
  link_url: null,
  link_label: null,
  prefill: null,
  no_paste: false,
  tools: null,
  asset: null,
  ...partial,
});

describe('onboarding page copy', () => {
  it('shows the Divine Acquisition login, payout methods, the phone rule, and Apploye', () => {
    const html = renderToStaticMarkup(
      createElement(OnboardingView, {
        token: 'preview-token-preview-token-preview',
        preview: true,
        initial: {
          state: 'open',
          recipientName: 'Ana Cruz',
          recipientType: 'operator',
          protocolName: 'VA Sales Operator Onboarding Protocol',
          protocolIntro: null,
          prefill: {},
          answers: { weekly_hours: { value: 'part_time_4_5' } },
          steps: [
            step({ key: 'da_login', label: 'Divine Acquisition username', kind: 'form_question', input_type: 'da_login' }),
            step({
              key: 'da_password',
              label: 'Password',
              kind: 'form_question',
              input_type: 'password',
              help: 'At least 12 characters.',
            }),
            step({
              key: 'payout',
              label: 'Preferred payout method',
              kind: 'form_question',
              input_type: 'payout',
              choices: [
                { value: 'wise', label: 'Wise' },
                { value: 'remitly', label: 'Remitly' },
              ],
            }),
            step({
              key: 'has_computer',
              label: 'Do you have a laptop or desktop you will use for this work?',
              kind: 'form_question',
              input_type: 'single_select',
              help: 'A phone is not allowed for this work, under any circumstances.',
              choices: [
                { value: 'yes', label: 'Yes - I have a laptop or desktop' },
                { value: 'no', label: 'No - I only have a phone' },
              ],
            }),
            step({
              key: 'apploye_download',
              label: 'I have downloaded Apploye. I understand I am tracked on productivity, not just time. Inactivity is visible.',
              kind: 'acknowledgment',
              help: 'Apploye tracks productivity, including inactivity, not just time.',
              link_url: 'https://apploye.com/download',
              link_label: 'Download Apploye',
            }),
            step({
              key: 'weekly_hours',
              label: 'Weekly hours you can commit',
              kind: 'form_question',
              input_type: 'single_select',
              choices: [
                { value: 'part_time_4_5', label: 'Part time - 4 to 5 hours' },
                { value: 'full_time_6_8', label: 'Full time - 6 to 8 hours' },
              ],
            }),
            step({
              key: 'work_schedule',
              label: 'Days and hours you can work',
              kind: 'form_question',
              input_type: 'schedule',
              show_when: { step: 'weekly_hours', values: ['part_time_4_5', 'full_time_6_8'] },
            }),
            step({
              key: 'industries_sold',
              label: 'Industries you have sold into',
              kind: 'form_question',
              input_type: 'multi_select',
              choices: [
                { value: 'med_spa', label: 'Med spa and aesthetics' },
                { value: 'home_services', label: 'Home services' },
                { value: 'hvac', label: 'HVAC' },
              ],
            }),
          ],
        },
      }),
    );
    expect(html).toContain('@divineacquisition.io');
    expect(html).toContain('Save password');
    expect(html).toContain('Wise');
    expect(html).toContain('Remitly');
    expect(html).toContain('A phone is not allowed');
    expect(html).toContain('Download Apploye');
    expect(html).toContain('Inactivity is visible');
    expect(html).toContain('Part time - 4 to 5 hours');
    expect(html).toContain('Monday');
    expect(html).toContain('Med spa and aesthetics');
    expect(html).toContain('Home services');
  });
});
