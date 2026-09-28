'use client';

import { useMemo, useState } from 'react';
import { btnPrimary, btnSecondary, btnSizeSm } from '@/app/components/ui';
import {
  changePayoutAction,
  removeDeviceAction,
  startMfaEnrollAction,
  submitTaxDocumentAction,
  updateProfileAction,
  verifyMfaEnrollAction,
} from '@/lib/portal/actions';
import { CHANNEL, OPERATOR_STATUS, PAYOUT_METHOD, TAX_STATUS } from '@/lib/portal/labels';
import { formatDate, formatDateTime } from '@/lib/portal/time';
import type { ProfileData } from '@/lib/portal/types';
import { Badge, inputClass, labelClass, selectClass } from '../../components/ui';
import { Card, CardTitle, Feedback, Sheet, useAction, usePortal, VaButton, VaFieldset } from './portal';

export default function ProfileView({ data }: { data: ProfileData }) {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Profile</h1>
      <Details data={data} />
      <Card>
        <CardTitle>Standing</CardTitle>
        <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <Fact label="Status">{OPERATOR_STATUS[data.status] ?? 'Sales Operator'}</Fact>
          <Fact label="Tier">{data.tier ?? '—'}</Fact>
          <Fact label="Certified">{data.certified_on ? formatDate(data.certified_on, true) : 'Not yet'}</Fact>
          <Fact label="Joined">{data.joined_on ? formatDate(data.joined_on, true) : '—'}</Fact>
        </dl>
      </Card>
      {data.pay_visible ? (
        <>
          <Payout data={data} />
          <Tax data={data} />
        </>
      ) : (
        <Card>
          <p className="text-sm text-neutral-500">Payout and tax details are not available to your role.</p>
        </Card>
      )}
      <Security data={data} />
      <Agreements data={data} />
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white/[0.03] px-3 py-2">
      <dt className="text-[11px] text-neutral-500">{label}</dt>
      <dd className="text-neutral-100">{children}</dd>
    </div>
  );
}

function Details({ data }: { data: ProfileData }) {
  const action = useAction();
  const zones = useMemo(() => {
    try {
      return (Intl as unknown as { supportedValuesOf: (key: string) => string[] }).supportedValuesOf('timeZone');
    } catch {
      return [data.time_zone];
    }
  }, [data.time_zone]);
  const [name, setName] = useState(data.name);
  const [phone, setPhone] = useState(data.phone ?? '');
  const [handle, setHandle] = useState(data.handle ?? '');
  const [zone, setZone] = useState(data.time_zone);
  const [channel, setChannel] = useState(data.preferred_channel ?? 'in_app');

  return (
    <Card>
      <CardTitle>Your details</CardTitle>
      <VaFieldset>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className={labelClass}>Email</span>
            <input value={data.email} disabled className={`${inputClass} opacity-60`} />
          </label>
          <label className="block">
            <span className={labelClass}>Phone</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" className={inputClass} />
          </label>
          <label className="block">
            <span className={labelClass}>Handle (Discord, WhatsApp)</span>
            <input value={handle} onChange={(e) => setHandle(e.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className={labelClass}>Time zone</span>
            <select value={zone} onChange={(e) => setZone(e.target.value)} className={selectClass}>
              {(zones.includes(zone) ? zones : [zone, ...zones]).map((z) => (
                <option key={z} value={z}>
                  {z.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelClass}>Notify me by</span>
            <select value={channel} onChange={(e) => setChannel(e.target.value)} className={selectClass}>
              {Object.entries(CHANNEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="button"
          disabled={action.pending}
          onClick={() => action.run(() => updateProfileAction({ name, phone, handle, timeZone: zone, channel }))}
          className={`${btnPrimary} ${btnSizeSm} mt-4`}
        >
          Save
        </button>
        <Feedback message={action.message} error={action.error} />
      </VaFieldset>
    </Card>
  );
}

function Payout({ data }: { data: ProfileData }) {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState(data.payout_method ?? 'wise');
  const [reference, setReference] = useState('');
  const [password, setPassword] = useState('');
  const action = useAction();
  return (
    <Card>
      <CardTitle>Payout method</CardTitle>
      <p className="text-sm text-neutral-200">
        {data.payout_method ? `${PAYOUT_METHOD[data.payout_method] ?? 'On file'} ending ${data.payout_last4 ?? '····'}` : 'None on file'}
      </p>
      <VaButton type="button" onClick={() => setOpen(true)} className={`${btnSecondary} mt-3 px-3 py-1.5 text-xs`} showReason>
        Change payout method
      </VaButton>
      <Sheet open={open} onClose={() => setOpen(false)} title="Change payout method">
        <p className="text-sm text-neutral-400">
          Changing where your pay goes needs your password again, and DA is told straight away. If you ever get a notice
          about a change you did not make, contact DA immediately.
        </p>
        <label className={`${labelClass} mt-4`}>Method</label>
        <select value={method} onChange={(e) => setMethod(e.target.value)} className={selectClass}>
          {Object.entries(PAYOUT_METHOD).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <label className={`${labelClass} mt-3`}>Account, email or wallet</label>
        <input value={reference} onChange={(e) => setReference(e.target.value)} className={inputClass} autoComplete="off" />
        <label className={`${labelClass} mt-3`}>Your password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} autoComplete="current-password" />
        <VaButton
          type="button"
          disabled={action.pending || reference.trim().length < 4 || !password}
          onClick={() =>
            action.run(() => changePayoutAction({ method, reference, password }), (r) => {
              setPassword('');
              if (r.ok) {
                setReference('');
                setOpen(false);
              }
            })
          }
          className={`${btnPrimary} ${btnSizeSm} mt-4`}
        >
          Confirm the change
        </VaButton>
        <Feedback error={action.error} />
      </Sheet>
      <Feedback message={action.message} />
    </Card>
  );
}

function Tax({ data }: { data: ProfileData }) {
  const status = TAX_STATUS[data.tax_doc_status ?? 'missing'] ?? TAX_STATUS.missing;
  const [link, setLink] = useState('');
  const action = useAction();
  const canSubmit = data.tax_doc_status !== 'on_file' && data.tax_doc_status !== 'submitted';
  return (
    <Card>
      <CardTitle aside={<Badge tone={status.tone}>{status.label}</Badge>}>Tax documents</CardTitle>
      <p className="text-sm text-neutral-400">{status.detail}.</p>
      {canSubmit ? (
        <VaFieldset className="mt-3">
          <label className={labelClass}>Link to your document (Drive or Dropbox, shared with DA)</label>
          <input value={link} onChange={(e) => setLink(e.target.value)} className={inputClass} placeholder="https://" />
          <button
            type="button"
            disabled={action.pending || !link.startsWith('https://')}
            onClick={() => action.run(() => submitTaxDocumentAction(link), (r) => r.ok && setLink(''))}
            className={`${btnPrimary} ${btnSizeSm} mt-3`}
          >
            Submit for review
          </button>
          <Feedback message={action.message} error={action.error} />
        </VaFieldset>
      ) : null}
    </Card>
  );
}

function Security({ data }: { data: ProfileData }) {
  const { operatorZone } = usePortal();
  const action = useAction();
  const [enroll, setEnroll] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState('');

  return (
    <Card>
      <CardTitle aside={<Badge tone={data.mfa_enabled ? 'good' : 'warning'}>{data.mfa_enabled ? '2FA on' : '2FA off'}</Badge>}>
        Sign-in security
      </CardTitle>
      {!data.mfa_enabled ? (
        <div className="mb-4">
          <p className="text-sm text-neutral-400">Protect your account with an authenticator app.</p>
          {enroll ? (
            <div className="mt-3 space-y-2">
              {/* The QR code is an SVG data URL generated by the auth server. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={enroll.qr} alt="Scan with your authenticator app" className="h-44 w-44 rounded-xl bg-white p-2" />
              <p className="break-all text-xs text-neutral-500">Or enter this key: {enroll.secret}</p>
              <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" placeholder="6-digit code" className={inputClass} />
              <VaButton
                type="button"
                disabled={action.pending || code.replace(/\s/g, '').length < 6}
                onClick={() => action.run(() => verifyMfaEnrollAction(enroll.factorId, code), (r) => r.ok && setEnroll(null))}
                className={`${btnPrimary} ${btnSizeSm}`}
              >
                Turn on
              </VaButton>
            </div>
          ) : (
            <VaButton
              type="button"
              disabled={action.pending}
              onClick={() =>
                action.run(() => startMfaEnrollAction(), (r) => {
                  if (r.ok && r.data) setEnroll(r.data);
                })
              }
              className={`${btnPrimary} ${btnSizeSm} mt-2`}
              showReason
            >
              Set up two-factor sign-in
            </VaButton>
          )}
        </div>
      ) : null}

      <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Known devices</p>
      <ul className="space-y-1.5">
        {data.devices.length === 0 ? <li className="text-sm text-neutral-500">None recorded yet.</li> : null}
        {data.devices.map((device) => (
          <li key={device.fingerprint} className="flex items-center justify-between gap-2 rounded-xl bg-white/[0.03] px-3 py-2 text-sm">
            <span className="min-w-0">
              <span className="block truncate text-neutral-200">{device.label ?? 'Unnamed device'}</span>
              <span className="text-[11px] text-neutral-500">Last seen {formatDateTime(device.last_seen_at, operatorZone)}</span>
            </span>
            <VaButton
              type="button"
              disabled={action.pending}
              onClick={() => action.run(() => removeDeviceAction(device.fingerprint))}
              className={`${btnSecondary} px-3 py-1 text-xs`}
            >
              Remove
            </VaButton>
          </li>
        ))}
      </ul>

      <p className="mb-1.5 mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Recent sign-ins</p>
      <ul className="space-y-1 text-sm">
        {data.sign_ins.length === 0 ? <li className="text-neutral-500">None recorded yet.</li> : null}
        {data.sign_ins.map((event, index) => (
          <li key={index} className="flex justify-between gap-2 text-neutral-300">
            <span>{formatDateTime(event.at, operatorZone)}</span>
            <span className="text-xs text-neutral-500">
              {event.outcome === 'success' ? 'Signed in' : event.outcome.startsWith('step_up') ? 'Password check' : 'Failed attempt'}
              {event.city || event.country ? ` · ${[event.city, event.country].filter(Boolean).join(', ')}` : ''}
            </span>
          </li>
        ))}
      </ul>
      <Feedback message={action.message} error={action.error} />
    </Card>
  );
}

function Agreements({ data }: { data: ProfileData }) {
  return (
    <Card>
      <CardTitle>Agreements</CardTitle>
      <ul className="space-y-2">
        {data.agreements.length === 0 ? <li className="text-sm text-neutral-500">No agreements on file.</li> : null}
        {data.agreements.map((agreement) => (
          <li key={agreement.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2 text-sm">
            <span className="min-w-0">
              <span className="block text-neutral-200">{agreement.name}</span>
              <span className="text-[11px] text-neutral-500">
                {agreement.status === 'completed' && agreement.completed_at
                  ? `Signed ${formatDate(agreement.completed_at.slice(0, 10), true)}`
                  : 'Not signed yet'}
              </span>
            </span>
            {agreement.has_copy ? (
              <a href={`/vistrial/operator/agreements/${agreement.id}`} className={`${btnSecondary} px-3 py-1 text-xs`}>
                View
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}
