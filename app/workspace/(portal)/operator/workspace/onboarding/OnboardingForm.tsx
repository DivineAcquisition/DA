'use client';

import { useState } from 'react';
import Link from 'next/link';
import { saveOnboardingAction } from '@/lib/hire/actions';
import { stepErrors, zoneHours, type OnboardingDraft } from '@/lib/hire/rules';

const HOURS = [
  ['under_20', 'Under 20'],
  ['20_30', '20 to 30'],
  ['30_40', '30 to 40'],
  ['40_plus', '40 plus'],
];
const YEARS = [
  ['none', 'None'],
  ['under_1', 'Under 1'],
  ['1_2', '1 to 2'],
  ['3_5', '3 to 5'],
  ['5_plus', '5 plus'],
];
const ROLES = ['sdr', 'appointment_setter', 'closer', 'va', 'customer_service', 'other'];
const TOOLS = ['ghl', 'other_crm', 'dialer', 'slack', 'discord', 'google', 'other'];
const VERTICALS = [
  ['home_services', 'Home Services and Cleaning'],
  ['med_spa', 'Med Spa'],
  ['coaches', 'Coaches and Consultants'],
  ['no_preference', 'No preference'],
];
const ZONES = ['eastern', 'central', 'mountain', 'pacific'] as const;
const ACKS: { key: keyof OnboardingDraft; label: string }[] = [
  { key: 'ack_academy', label: "I'll complete the DA Operator Academy before or during my first placement, by the date I'm given." },
  { key: 'ack_gates', label: "I'll pass each module gate in order." },
  { key: 'ack_logins', label: "I'll do all client work under my own logins, never shared ones." },
  { key: 'ack_confidential', label: "I'll keep all client information confidential." },
  { key: 'ack_eod', label: "I'll submit an EOD every working day by the deadline." },
  { key: 'ack_myself', label: "I'll do the work myself." },
];

const field = 'mt-1 w-full rounded-xl border border-white/10 bg-ink-950 px-3 py-3 text-base text-white';

function toggle(list: string[] | undefined, value: string) {
  const next = new Set(list ?? []);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return [...next];
}

export default function OnboardingForm({
  initial,
  payoutComplete,
  acknowledgmentsLocked,
}: {
  initial: OnboardingDraft;
  payoutComplete: boolean;
  acknowledgmentsLocked: boolean;
}) {
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<OnboardingDraft>(initial);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const set = (patch: Partial<OnboardingDraft>) => setDraft((current) => ({ ...current, ...patch }));

  async function save(submit = false) {
    const problems = stepErrors(step, draft, payoutComplete);
    if (!submit && problems.length) {
      setError(problems[0]);
      return;
    }
    setPending(true);
    setError(null);
    const result = await saveOnboardingAction(draft, submit, payoutComplete);
    setPending(false);
    if (!result.ok) setError(result.error);
    else {
      setMessage(result.message);
      if (!submit) setStep((current) => Math.min(8, current + 1));
    }
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        void save(step === 8);
      }}
    >
      <p className="text-sm text-neutral-400">Step {step} of 8. Progress saves when you continue.</p>
      {step === 1 ? (
        <div className="space-y-3">
          <label className="block text-sm">Full legal name<input className={field} value={draft.legal_name ?? ''} onChange={(e) => set({ legal_name: e.target.value })} required /></label>
          <label className="block text-sm">Preferred name<input className={field} value={draft.preferred_name ?? ''} onChange={(e) => set({ preferred_name: e.target.value })} required /></label>
          <label className="block text-sm">Personal email<input className={field} type="email" value={draft.personal_email ?? ''} onChange={(e) => set({ personal_email: e.target.value })} /></label>
          <label className="block text-sm">Mobile, with country code<input className={field} inputMode="tel" placeholder="+1 415 555 0123" value={draft.mobile ?? ''} onChange={(e) => set({ mobile: e.target.value })} required /></label>
          <label className="block text-sm">Discord username<input className={field} value={draft.discord ?? ''} onChange={(e) => set({ discord: e.target.value })} required /></label>
          <label className="block text-sm">City<input className={field} value={draft.city ?? ''} onChange={(e) => set({ city: e.target.value })} required /></label>
          <label className="block text-sm">State or region<input className={field} value={draft.region ?? ''} onChange={(e) => set({ region: e.target.value })} required /></label>
          <label className="block text-sm">Country<input className={field} value={draft.country ?? ''} onChange={(e) => set({ country: e.target.value })} required /></label>
          <label className="block text-sm">Time zone
            <input className={field} value={draft.time_zone ?? ''} onChange={(e) => set({ time_zone: e.target.value })} required />
          </label>
          <button type="button" className="text-sm text-[#937DFF]" onClick={() => set({ time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone })}>Use the time zone on this phone</button>
        </div>
      ) : null}
      {step === 2 ? (
        <div className="space-y-3">
          <label className="block text-sm">Weekly hours
            <select className={field} value={draft.weekly_hours ?? ''} onChange={(e) => set({ weekly_hours: e.target.value })}>
              <option value="">Choose</option>
              {HOURS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="block text-sm">Days you can work<input className={field} value={draft.work_days ?? ''} onChange={(e) => set({ work_days: e.target.value })} required /></label>
          <label className="block text-sm">Hours, in your time zone<input className={field} value={draft.work_hours ?? ''} onChange={(e) => set({ work_hours: e.target.value })} required /></label>
          <label className="block text-sm">Earliest start date<input className={field} type="date" value={draft.earliest_start ?? ''} onChange={(e) => set({ earliest_start: e.target.value })} required /></label>
          <label className="block text-sm">Known time off in the next 30 days<textarea className={field} value={draft.time_off ?? ''} onChange={(e) => set({ time_off: e.target.value })} /></label>
          <fieldset className="space-y-2">
            <legend className="text-sm">US time zones you can cover</legend>
            {ZONES.map((zone) => (
              <label key={zone} className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1" checked={(draft.us_zones ?? []).includes(zone)} onChange={() => set({ us_zones: toggle(draft.us_zones, zone) })} />
                <span>{zone} <span className="block text-neutral-500">{zoneHours(zone, draft.time_zone || 'UTC')}</span></span>
              </label>
            ))}
          </fieldset>
        </div>
      ) : null}
      {step === 3 ? (
        <div className="space-y-3">
          <label className="block text-sm">Years in sales or outbound
            <select className={field} value={draft.years ?? ''} onChange={(e) => set({ years: e.target.value })}>
              <option value="">Choose</option>
              {YEARS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <fieldset className="space-y-2 text-sm">
            <legend>Roles held</legend>
            {ROLES.map((role) => (
              <label key={role} className="flex gap-2"><input type="checkbox" checked={(draft.roles ?? []).includes(role)} onChange={() => set({ roles: toggle(draft.roles, role) })} />{role.replaceAll('_', ' ')}</label>
            ))}
          </fieldset>
          <fieldset className="space-y-2 text-sm">
            <legend>Tools used</legend>
            {TOOLS.map((tool) => (
              <label key={tool} className="flex gap-2"><input type="checkbox" checked={(draft.tools ?? []).includes(tool)} onChange={() => set({ tools: toggle(draft.tools, tool) })} />{tool.replaceAll('_', ' ')}</label>
            ))}
          </fieldset>
          <label className="block text-sm">Industries sold into<textarea className={field} value={draft.industries ?? ''} onChange={(e) => set({ industries: e.target.value })} /></label>
          <fieldset className="space-y-2 text-sm">
            <legend>Verticals you want</legend>
            {VERTICALS.map(([value, label]) => (
              <label key={value} className="flex gap-2"><input type="checkbox" checked={(draft.verticals ?? []).includes(value)} onChange={() => set({ verticals: toggle(draft.verticals, value) })} />{label}</label>
            ))}
          </fieldset>
        </div>
      ) : null}
      {step === 4 ? (
        <div className="space-y-3 text-sm">
          <p>A no does not block the form. It is flagged for your manager.</p>
          {(['laptop', 'headset', 'quiet'] as const).map((key) => (
            <label key={key} className="block capitalize">{key.replaceAll('_', ' ')}
              <select className={field} value={draft[key] ?? ''} onChange={(e) => set({ [key]: e.target.value })}>
                <option value="">Choose</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>
          ))}
          <label className="block">Reliable internet
            <select className={field} value={draft.internet ?? ''} onChange={(e) => set({ internet: e.target.value })}>
              <option value="">Choose</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
          <a className="text-[#937DFF]" href="https://fast.com" target="_blank" rel="noreferrer">Run a speed test</a>
          <label className="block">Speed test result<input className={field} value={draft.internet_speed ?? ''} onChange={(e) => set({ internet_speed: e.target.value })} /></label>
        </div>
      ) : null}
      {step === 5 ? (
        <div className="space-y-3 text-sm">
          <p>Payout details are collected on your account page. They are not saved in this form, and managers cannot see them.</p>
          <Link className="inline-flex text-[#937DFF]" href="/workspace/operator/profile">Open payout details</Link>
          <p>{payoutComplete ? 'Payout details are complete.' : 'Payout details are not complete yet.'}</p>
        </div>
      ) : null}
      {step === 6 ? (
        <div className="space-y-3">
          <label className="block text-sm">Emergency contact name<input className={field} value={draft.emergency_name ?? ''} onChange={(e) => set({ emergency_name: e.target.value })} required /></label>
          <label className="block text-sm">Relationship<input className={field} value={draft.emergency_relationship ?? ''} onChange={(e) => set({ emergency_relationship: e.target.value })} required /></label>
          <label className="block text-sm">Phone<input className={field} inputMode="tel" value={draft.emergency_phone ?? ''} onChange={(e) => set({ emergency_phone: e.target.value })} required /></label>
        </div>
      ) : null}
      {step === 7 ? (
        <fieldset className="space-y-3 text-sm" disabled={acknowledgmentsLocked}>
          {ACKS.map((ack) => (
            <label key={ack.key} className="flex items-start gap-2">
              <input type="checkbox" className="mt-1" checked={Boolean(draft[ack.key])} onChange={(e) => set({ [ack.key]: e.target.checked })} />
              {ack.label}
            </label>
          ))}
          {acknowledgmentsLocked ? <p className="text-neutral-400">Acknowledgments were recorded and stay as they were.</p> : null}
        </fieldset>
      ) : null}
      {step === 8 ? (
        <div className="space-y-3">
          <label className="block text-sm">Why do you want to work with DA?<textarea className={field} value={draft.why ?? ''} onChange={(e) => set({ why: e.target.value })} required /></label>
          <label className="block text-sm">Strongest sales skill<input className={field} value={draft.skill ?? ''} onChange={(e) => set({ skill: e.target.value })} required /></label>
          <label className="block text-sm">What do you want to be doing in 12 months?<input className={field} value={draft.year_goal ?? ''} onChange={(e) => set({ year_goal: e.target.value })} required /></label>
        </div>
      ) : null}
      {error ? <p className="text-sm text-[#FFB020]">{error}</p> : null}
      {message ? <p className="text-sm text-neutral-300">{message}</p> : null}
      <div className="flex flex-wrap gap-2">
        {step > 1 ? <button type="button" className="h-11 rounded-xl border border-white/10 px-4 text-sm" onClick={() => setStep((current) => current - 1)}>Back</button> : null}
        {step < 8 ? <button type="button" disabled={pending || (step === 5 && !payoutComplete)} className="h-11 rounded-xl bg-[#6A00FF] px-4 text-sm font-semibold" onClick={() => void save(false)}>{pending ? 'Saving' : 'Save and continue'}</button> : null}
        {step === 8 ? <button type="submit" disabled={pending} className="h-11 rounded-xl bg-[#6A00FF] px-4 text-sm font-semibold">{pending ? 'Submitting' : 'Submit onboarding'}</button> : null}
      </div>
    </form>
  );
}
