'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createOperatorAction, createOperatorsFromApplicationsAction, hireOptionsAction, searchApplicationsAction } from '@/lib/hire/actions';

const field = 'mt-1 w-full rounded-xl border border-white/10 bg-ink-950 px-3 py-3 text-base text-white';

type AppRow = { id: string; name: string; email: string; phone?: string; status?: string; role?: string };

export default function AddOperatorForm() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [managers, setManagers] = useState<{ id: string; name: string }[]>([]);
  const [programs, setPrograms] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [apps, setApps] = useState<AppRow[]>([]);
  const [picked, setPicked] = useState<AppRow[]>([]);
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    work_email: '',
    personal_email: '',
    phone: '',
    role_kind: 'sales_operator',
    manager_id: '',
    application_id: '',
    program_id: '',
    grant_override: false,
    override_reason: '',
    note: '',
  });

  useEffect(() => {
    void hireOptionsAction().then((result) => {
      if (result.ok && result.options) {
        setManagers(result.options.managers ?? []);
        setPrograms(result.options.programs ?? []);
        const core = result.options.programs?.find((program) => program.slug === 'da-operator-academy');
        if (core) setForm((current) => ({ ...current, program_id: current.program_id || core.id }));
      }
    });
  }, []);

  function applyApp(row: AppRow) {
    const [first, ...rest] = row.name.split(' ');
    setForm((current) => ({
      ...current,
      first_name: first || '',
      last_name: rest.join(' '),
      work_email: row.email,
      phone: row.phone || '',
      application_id: row.id,
    }));
    setPicked((current) => (current.some((item) => item.id === row.id) ? current : [...current, row]));
  }

  async function submit() {
    setPending(true);
    setError(null);
    const result = await createOperatorAction({ ...form, grant_override: form.grant_override });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (result.operatorId) router.push(`/workspace/team/workspace/operators/${result.operatorId}`);
  }

  async function bulk() {
    setPending(true);
    setError(null);
    const result = await createOperatorsFromApplicationsAction(picked, form.manager_id);
    setPending(false);
    if (!result.ok) setError(result.error);
    else router.push('/workspace/team/workspace/operators');
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-neutral-400">Step {step} of 3</p>
      {step === 1 ? (
        <div className="space-y-3">
          <label className="block text-sm">First name<input className={field} value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></label>
          <label className="block text-sm">Last name<input className={field} value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></label>
          <label className="block text-sm">Work email<input className={field} type="email" value={form.work_email} onChange={(e) => setForm({ ...form, work_email: e.target.value })} /></label>
          <label className="block text-sm">Personal email<input className={field} type="email" value={form.personal_email} onChange={(e) => setForm({ ...form, personal_email: e.target.value })} /></label>
          <label className="block text-sm">Role
            <select className={field} value={form.role_kind} onChange={(e) => setForm({ ...form, role_kind: e.target.value })}>
              <option value="sales_operator">Sales Operator</option>
              <option value="va">VA</option>
            </select>
          </label>
          <label className="block text-sm">Manager
            <select className={field} value={form.manager_id} onChange={(e) => setForm({ ...form, manager_id: e.target.value })}>
              <option value="">Choose</option>
              {managers.map((manager) => <option key={manager.id} value={manager.id}>{manager.name}</option>)}
            </select>
          </label>
          <div className="space-y-2">
            <label className="block text-sm">Hiring application
              <input className={field} placeholder="Search name or email" onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                void searchApplicationsAction((event.target as HTMLInputElement).value).then((result) => {
                  if (result.ok) setApps(result.rows as AppRow[]);
                });
              }} />
            </label>
            <ul className="space-y-1 text-sm">
              {apps.map((row) => (
                <li key={row.id}>
                  <button type="button" className="text-left text-[#937DFF]" onClick={() => applyApp(row)}>{row.name} · {row.email} · {row.status}</button>
                </li>
              ))}
            </ul>
          </div>
          <button type="button" className="h-11 rounded-xl bg-[#6A00FF] px-4 text-sm font-semibold" onClick={() => setStep(2)}>Continue</button>
        </div>
      ) : null}
      {step === 2 ? (
        <div className="space-y-3">
          <label className="block text-sm">Academy program
            <select className={field} value={form.program_id} onChange={(e) => setForm({ ...form, program_id: e.target.value })}>
              {programs.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.grant_override} onChange={(e) => setForm({ ...form, grant_override: e.target.checked })} />
            Grant a certification override now
          </label>
          {form.grant_override ? <label className="block text-sm">Reason<textarea className={field} value={form.override_reason} onChange={(e) => setForm({ ...form, override_reason: e.target.value })} /></label> : null}
          <label className="block text-sm">Note<textarea className={field} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
          <div className="flex gap-2">
            <button type="button" className="h-11 rounded-xl border border-white/10 px-4 text-sm" onClick={() => setStep(1)}>Back</button>
            <button type="button" className="h-11 rounded-xl bg-[#6A00FF] px-4 text-sm font-semibold" onClick={() => setStep(3)}>Review</button>
          </div>
        </div>
      ) : null}
      {step === 3 ? (
        <div className="space-y-3 text-sm">
          <p>{form.first_name} {form.last_name} · {form.work_email} · {form.role_kind === 'va' ? 'VA' : 'Sales Operator'}</p>
          <p>This creates or links the account, the operator record, the onboarding checklist, and the Academy enrollment. Stage starts at Invited.</p>
          <p>Emails: auth.invite when they do not already have an account, and operator.welcome.</p>
          {picked.length > 1 ? <p>{picked.length} selected applications will each go through the same rules.</p> : null}
          {error ? <p className="text-[#FFB020]">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="h-11 rounded-xl border border-white/10 px-4" onClick={() => setStep(2)}>Back</button>
            <button type="button" disabled={pending} className="h-11 rounded-xl bg-[#6A00FF] px-4 font-semibold" onClick={() => void submit()}>{pending ? 'Creating' : 'Create and invite'}</button>
            {picked.length > 1 ? <button type="button" disabled={pending} className="h-11 rounded-xl border border-white/10 px-4" onClick={() => void bulk()}>Add selected applications</button> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
