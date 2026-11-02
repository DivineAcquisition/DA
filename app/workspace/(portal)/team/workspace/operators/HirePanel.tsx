import Link from 'next/link';
import { controlRpc, readable } from '@/lib/ad/rpc';
import { STAGE_LABEL, type HireStage } from '@/lib/hire/rules';
import {
  clearSetupAction,
  extendOverrideAction,
  grantOverrideAction,
  offboardAction,
  revokeOverrideAction,
  tickOffboardAction,
  waiveReadinessAction,
  saveGhlAction,
} from '@/lib/hire/actions';
import { createClient } from '@/lib/supabase/server';
import ReportForm from '@/app/workspace/(portal)/team/workspace/reports/ReportForm';

type Item = { key: string; state: 'met' | 'missing' | 'waived' | 'flagged'; detail: string };
type View = {
  journey: { stage: HireStage; reason: string | null; reminder_count: number; last_day: string | null; offboard_reason: string | null } | null;
  answers: Record<string, unknown> | null;
  payout_complete: boolean;
  readiness: Item[];
  override: { id: string; reason: string; expires_on: string; days_left: number } | null;
  offboard: { key: string; label: string; done: boolean }[];
  ghl: { id: string; user: boolean | null; mapped: boolean | null; phone: string | null; operator_confirmed: boolean; client_id: string | null }[];
  setup_flags: string[];
  setup_cleared: boolean;
};

const LABEL: Record<string, string> = {
  account: 'Account active and signed in',
  onboarding: 'Onboarding form',
  agreement: 'Agreement signed',
  payout: 'Payout details',
  academy: 'Academy Level 1 or an active override',
  setup: 'Setup check',
  manager: 'Manager assigned',
};

export default async function HirePanel({ operatorId, email, name, isAdmin }: { operatorId: string; email: string | null; name: string; isAdmin: boolean }) {
  const supabase = await createClient();
  const { data, error } = await controlRpc<View>(supabase, 'hire_operator_view', { p_operator: operatorId });
  if (error) return <p className="text-sm text-[#FFB020]">{readable(error)}</p>;
  if (!data?.journey) return null;
  const answers = data.answers ?? {};
  return (
    <section className="panel space-y-4 rounded-2xl p-5">
      <div>
        <h2 className="text-lg font-semibold text-white">{STAGE_LABEL[data.journey.stage] ?? data.journey.stage}</h2>
        {data.journey.reason ? <p className="text-sm text-neutral-400">{data.journey.reason}</p> : null}
      </div>
      <ul className="space-y-2 text-sm">
        {(data.readiness ?? []).map((item) => (
          <li key={item.key} className="flex flex-wrap items-center justify-between gap-2">
            <span>
              <span className="text-white">{LABEL[item.key] ?? item.key}</span>
              <span className="mt-1 block text-neutral-400">
                {item.state === 'met' ? 'Met' : item.state === 'waived' ? `Waived · ${item.detail}` : item.state === 'flagged' ? `Flagged · ${item.detail}` : `Not yet · ${item.detail}`}
              </span>
            </span>
            {isAdmin && item.state !== 'waived' ? (
              <ReportForm action={waiveReadinessAction} className="flex flex-wrap gap-2">
                <input type="hidden" name="operator_id" value={operatorId} />
                <input type="hidden" name="item" value={item.key} />
                <input name="reason" required minLength={3} placeholder="Reason" aria-label={`Waive ${item.key}`} className="h-9 rounded-lg border border-white/10 bg-ink-950 px-2 text-sm" />
                <button className="text-[#937DFF]" type="submit">Waive</button>
              </ReportForm>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="text-sm text-neutral-400">Payout details: {data.payout_complete ? 'yes' : 'no'}. The payout record itself is not shown here.</p>
      {data.setup_flags?.length && !data.setup_cleared ? (
        <form action={async () => { await clearSetupAction(operatorId); }}>
          <button className="text-sm text-[#937DFF]" type="submit">Clear flagged setup ({data.setup_flags.join(', ')})</button>
        </form>
      ) : null}
      <div className="space-y-2 text-sm">
        <h3 className="font-semibold text-white">Onboarding answers</h3>
        <dl className="grid gap-2 sm:grid-cols-2">
          {Object.entries(answers)
            .filter(([key]) => !/payout|account_number|routing/i.test(key))
            .map(([key, value]) => (
              <div key={key}>
                <dt className="text-neutral-500">{key.replaceAll('_', ' ')}</dt>
                <dd className="text-white">{Array.isArray(value) ? value.join(', ') : String(value ?? '')}</dd>
              </div>
            ))}
        </dl>
      </div>
      {data.override ? (
        <p className="text-sm text-white">Override through {data.override.expires_on}. {data.override.days_left} days left. {data.override.reason}</p>
      ) : null}
      {isAdmin ? (
        <div className="space-y-3">
          <ReportForm action={grantOverrideAction} className="grid gap-2 sm:grid-cols-2">
            <input type="hidden" name="operator_id" value={operatorId} />
            <input type="hidden" name="email" value={email ?? ''} />
            <input type="hidden" name="name" value={name} />
            <input name="reason" required minLength={3} placeholder="Override reason" aria-label="Override reason" className="h-9 rounded-lg border border-white/10 bg-ink-950 px-2 text-sm" />
            <input name="start" type="date" aria-label="Override start" className="h-9 rounded-lg border border-white/10 bg-ink-950 px-2 text-sm" />
            <input name="days" type="number" min={1} max={60} defaultValue={30} aria-label="Override days" className="h-9 rounded-lg border border-white/10 bg-ink-950 px-2 text-sm" />
            <label className="text-sm text-neutral-300"><input type="checkbox" name="exception" /> Exception past 60 days</label>
            <button className="text-sm text-[#937DFF]" type="submit">Grant override</button>
          </ReportForm>
          {data.override ? (
            <ReportForm action={extendOverrideAction} className="flex flex-wrap gap-2">
              <input type="hidden" name="override_id" value={data.override.id} />
              <input name="expires" type="date" required aria-label="New expiry" className="h-9 rounded-lg border border-white/10 bg-ink-950 px-2 text-sm" />
              <input name="reason" required minLength={3} placeholder="Why extend" aria-label="Extend reason" className="h-9 rounded-lg border border-white/10 bg-ink-950 px-2 text-sm" />
              <label className="text-sm"><input type="checkbox" name="exception" /> Exception</label>
              <button className="text-sm text-[#937DFF]" type="submit">Extend</button>
            </ReportForm>
          ) : null}
          {data.override ? (
            <ReportForm action={revokeOverrideAction} className="flex gap-2">
              <input type="hidden" name="override_id" value={data.override.id} />
              <input name="reason" required minLength={3} placeholder="Why revoke" aria-label="Revoke reason" className="h-9 rounded-lg border border-white/10 bg-ink-950 px-2 text-sm" />
              <button className="text-sm text-[#FFB020]" type="submit">Revoke</button>
            </ReportForm>
          ) : null}
          <ReportForm action={offboardAction} className="flex flex-wrap gap-2">
            <input type="hidden" name="operator_id" value={operatorId} />
            <input name="last_day" type="date" required aria-label="Last day" className="h-9 rounded-lg border border-white/10 bg-ink-950 px-2 text-sm" />
            <input name="reason" required minLength={3} placeholder="Why they are leaving" aria-label="Off-board reason" className="h-9 rounded-lg border border-white/10 bg-ink-950 px-2 text-sm" />
            <button className="text-sm text-[#FFB020]" type="submit">Off-board</button>
          </ReportForm>
          <ul className="space-y-1 text-sm">
            {data.offboard.map((item) => (
              <li key={item.key} className="flex items-center justify-between gap-2">
                <span>{item.label} {item.done ? '· done' : ''}</span>
                {!item.done ? (
                  <ReportForm action={tickOffboardAction}>
                    <input type="hidden" name="operator_id" value={operatorId} />
                    <input type="hidden" name="item" value={item.key} />
                    <button className="text-[#937DFF]" type="submit">Tick</button>
                  </ReportForm>
                ) : null}
              </li>
            ))}
          </ul>
          <ReportForm action={saveGhlAction} className="grid gap-2 sm:grid-cols-2">
            <input type="hidden" name="operator_id" value={operatorId} />
            <input name="client_id" placeholder="Client id" aria-label="Client id" className="h-9 rounded-lg border border-white/10 bg-ink-950 px-2 text-sm" />
            <input name="placement_id" placeholder="Placement id" aria-label="Placement id" className="h-9 rounded-lg border border-white/10 bg-ink-950 px-2 text-sm" />
            <select name="user" aria-label="GHL user exists" className="h-9 rounded-lg border border-white/10 bg-ink-950 px-2 text-sm"><option value="no">User no</option><option value="yes">User yes</option></select>
            <select name="mapped" aria-label="Mapped" className="h-9 rounded-lg border border-white/10 bg-ink-950 px-2 text-sm"><option value="no">Mapped no</option><option value="yes">Mapped yes</option></select>
            <select name="phone" aria-label="Phone" className="h-9 rounded-lg border border-white/10 bg-ink-950 px-2 text-sm"><option value="no">Phone no</option><option value="yes">Phone yes</option><option value="not_needed">Phone not needed</option></select>
            <input name="confirmed_on" type="date" aria-label="Date confirmed" className="h-9 rounded-lg border border-white/10 bg-ink-950 px-2 text-sm" />
            <button className="text-sm text-[#937DFF]" type="submit">Save GHL readiness</button>
          </ReportForm>
        </div>
      ) : null}
      {data.ghl?.length ? (
        <ul className="text-sm text-neutral-300">
          {data.ghl.map((row) => (
            <li key={row.id}>GHL user {row.user ? 'yes' : 'no'} · mapped {row.mapped ? 'yes' : 'no'} · phone {row.phone ?? 'no'} · operator confirmed {row.operator_confirmed ? 'yes' : 'no'}</li>
          ))}
        </ul>
      ) : null}
      <Link href="/workspace/admin/operators" className="text-sm text-neutral-500">People</Link>
    </section>
  );
}
