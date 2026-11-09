import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { setEngagementStatusAction } from '@/lib/clients/actions';
import {
  CLIENT_TABS,
  ENGAGEMENT_STATUSES,
  STATUS_LABEL,
  TAB_LABEL,
  clientTab,
  getClientFile,
  isCaseFileId,
  loadClientAccess,
  loadClientDelivery,
  type ClientFile,
} from '@/lib/clients/desk';
import { inviteClientAction } from '@/lib/da/billingActions';
import {
  getBaseline,
  getGrowth,
  getHealth,
  listDecisions,
  listEvidence,
  listIndustryTemplates,
  listPlacements,
  listReports,
  listSnapshots,
} from '@/lib/da/queries';
import { formatMoney } from '@/lib/vistrial/format';
import BeginInstallButton from '@/app/da/components/BeginInstallButton';
import { ClientDetailsForm } from '@/app/da/components/EngagementSetup';
import OperatingConfigForm from '@/app/da/components/OperatingConfigForm';
import { GrowthTable, HeadlineDelta } from '@/app/da/components/growth';
import DeskForm from '../../components/DeskForm';
import { Fact, NextStep, Pill, Section, field, primary, secondary, when } from '../../components/desk';
import { EngagementPill } from '../bits';

export const metadata: Metadata = { title: 'Client' };
export const dynamic = 'force-dynamic';

function money(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? formatMoney(amount) : null;
}

function operatorName(operator: unknown): string {
  const row = Array.isArray(operator) ? operator[0] : operator;
  return (row as { name?: string } | null)?.name ?? 'Operator';
}

/** The one thing the engagement needs next, by status. */
function nextClientStep(file: ClientFile, seats: number, hasBaseline: boolean): { label: string; href: string | null } {
  const tab = (name: string) => `/workspace/clients/${file.id}?tab=${name}`;
  if (file.status === 'ended') return { label: 'Engagement ended. The file stays as the record.', href: null };
  if (file.status === 'paused') return { label: 'Paused. Set the status back to Active when it resumes.', href: tab('relationship') };
  if (!hasBaseline) return { label: 'Capture the baseline during the audit', href: `/workspace/growth/${file.slug}/baseline` };
  if (file.status === 'audit') return { label: 'Begin the install. It locks the baseline.', href: tab('growth') };
  if (seats === 0) return { label: 'Place a Sales Operator on this client', href: `/workspace/placements/new?client=${file.id}` };
  return { label: 'Review delivery: EODs and client reports', href: tab('delivery') };
}

export default async function ClientFilePage({
  params,
  searchParams,
}: {
  params: Promise<{ ref: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ ref }, { tab: rawTab }] = await Promise.all([params, searchParams]);
  const file = await getClientFile(ref);
  if (!file) notFound();
  // An old Growth link opens by slug. The file's one URL is by id.
  if (!isCaseFileId(ref)) redirect(`/workspace/clients/${file.id}${rawTab ? `?tab=${rawTab}` : ''}`);
  const tab = clientTab(rawTab);
  const [placements, baseline] = await Promise.all([listPlacements(file.id), getBaseline(file.id)]);
  const seats = placements.filter((placement) => ['active', 'scheduled', 'paused'].includes(String(placement.status))).length;
  const next = nextClientStep(file, seats, Boolean(baseline));

  return (
    <div className="space-y-5">
      <Link href="/workspace/clients" className="text-sm text-neutral-400 hover:text-white">
        Case files
      </Link>
      <header className="panel rounded-2xl p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold text-white">{file.name}</h1>
          <EngagementPill status={file.status} />
        </div>
        <p className="mt-1 text-sm text-neutral-400">
          {[file.vertical, file.contact_name, file.contact_email].filter(Boolean).join(' · ') || 'No contact on file.'}
        </p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-4">
          <Fact label="Status">{STATUS_LABEL[file.status as keyof typeof STATUS_LABEL] ?? file.status}</Fact>
          <Fact label="Engagement start">{file.engagement_start ?? '—'}</Fact>
          <Fact label="Live seats">{seats}</Fact>
          <Fact label="Retainer">{money(file.retainer_amount) ?? '—'}</Fact>
        </dl>
        <div className="mt-4">
          <NextStep label={next.label} href={next.href} />
        </div>
      </header>

      <nav aria-label="Case file" className="flex gap-1 overflow-x-auto">
        {CLIENT_TABS.map((name) => (
          <Link
            key={name}
            href={`/workspace/clients/${file.id}?tab=${name}`}
            aria-current={tab === name ? 'page' : undefined}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-sm ${tab === name ? 'da-primary font-medium text-white' : 'border border-white/10 text-neutral-300 hover:text-white'}`}
          >
            {TAB_LABEL[name]}
          </Link>
        ))}
      </nav>

      {tab === 'relationship' ? <Relationship file={file} /> : null}
      {tab === 'business' ? <Business file={file} /> : null}
      {tab === 'access' ? <Access file={file} /> : null}
      {tab === 'growth' ? <Growth file={file} /> : null}
      {tab === 'team' ? <Team file={file} placements={placements} /> : null}
      {tab === 'delivery' ? <Delivery file={file} /> : null}
    </div>
  );
}

async function Relationship({ file }: { file: ClientFile }) {
  const decisions = await listDecisions(file.id).catch(() => []);
  return (
    <>
      <Section title="Contacts">
        <dl className="grid gap-3 sm:grid-cols-4">
          <Fact label="Main contact">{file.contact_name ?? '—'}</Fact>
          <Fact label="Email">{file.contact_email ?? '—'}</Fact>
          <Fact label="Role">{file.contact_role ?? '—'}</Fact>
          <Fact label="Reach them on">{file.contact_channel ?? '—'}</Fact>
          <Fact label="Phone">{file.phone ?? '—'}</Fact>
          <Fact label="Billing email">{file.billing_email ?? '—'}</Fact>
        </dl>
      </Section>
      <Section title="Status" hint="Installing starts from Begin install on the Growth tab, because it locks the baseline.">
        <DeskForm action={setEngagementStatusAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="case_file_id" value={file.id} />
          <select name="status" defaultValue={file.status} aria-label="Engagement status" className={field}>
            {ENGAGEMENT_STATUSES.map((value) => (
              <option key={value} value={value} disabled={value === 'installing' && file.status !== 'installing'}>
                {STATUS_LABEL[value]}
              </option>
            ))}
          </select>
          <button type="submit" className={secondary}>
            Set status
          </button>
        </DeskForm>
      </Section>
      <Section title="Notes">
        <p className="whitespace-pre-wrap text-sm text-neutral-200">{file.notes || <span className="text-neutral-500">No notes. Add them on Business.</span>}</p>
      </Section>
      <Section
        title="Decisions"
        hint="Material choices, with the reasoning."
        aside={
          <Link href={`/workspace/growth/${file.slug}/decisions`} className="text-sm text-brand-200 hover:text-white">
            Record a decision
          </Link>
        }
      >
        {decisions.length === 0 ? (
          <p className="text-sm text-neutral-500">None recorded.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {decisions.slice(0, 10).map((decision) => (
              <li key={decision.id} className="border-b border-white/[0.06] pb-3">
                <p className="text-white">{decision.what_was_decided}</p>
                <p className="mt-0.5 text-neutral-400">{decision.reasoning}</p>
                <p className="mt-0.5 text-xs text-neutral-500">
                  {decision.decided_on} · {decision.decided_by}
                  {decision.against_recommendation ? ' · against our recommendation' : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}

async function Business({ file }: { file: ClientFile }) {
  const templates = await listIndustryTemplates();
  const template = templates.find((item) => item.key === file.industry_key);
  const blank = !file.phone && !file.billing_email && !file.offer && !file.crm_stack && !file.time_zone && !file.notes;
  return (
    <>
      <Section title="Offer and operations">
        <dl className="mb-3 grid gap-3 sm:grid-cols-3">
          <Fact label="Offer">{file.offer ?? '—'}</Fact>
          <Fact label="Time zone and hours">{file.time_zone ?? '—'}</Fact>
          <Fact label="Monthly ad spend">{money(file.monthly_ad_spend) ?? '—'}</Fact>
          <Fact label="CRM / stack">{file.crm_stack ?? '—'}</Fact>
        </dl>
        <ClientDetailsForm
          caseFileId={file.id}
          slug={file.slug}
          startOpen={blank}
          phone={file.phone}
          billingEmail={file.billing_email}
          offer={file.offer}
          monthlyAdSpend={file.monthly_ad_spend == null ? null : String(file.monthly_ad_spend)}
          crmStack={file.crm_stack}
          timeZone={file.time_zone}
          notes={file.notes}
        />
      </Section>
      <Section title="Industry and the qualified booking" hint="The template decides the shift questions. The definition is what counts as a qualified booking.">
        <dl className="mb-3 grid gap-3 sm:grid-cols-2">
          <Fact label="Industry template">{template?.name ?? file.industry_key ?? 'Generic'}</Fact>
          <Fact label="Qualified booking">{file.qualified_booking_definition ?? '—'}</Fact>
        </dl>
        <OperatingConfigForm
          caseFileId={file.id}
          slug={file.slug}
          templates={templates}
          currentIndustryKey={file.industry_key ?? 'generic'}
          currentDefinition={file.qualified_booking_definition}
          currentContactRole={file.contact_role}
          currentContactChannel={file.contact_channel}
        />
      </Section>
    </>
  );
}

async function Access({ file }: { file: ClientFile }) {
  const access = await loadClientAccess(file.id);
  return (
    <>
      <Section title="Client login" hint="Each person from the business gets their own account. Never a shared login.">
        {access.accounts.length === 0 ? (
          <p className="mb-3 text-sm text-neutral-500">No client accounts yet.</p>
        ) : (
          <ul className="mb-3 space-y-1 text-sm">
            {access.accounts.map((account) => (
              <li key={account.profile_id} className="flex flex-wrap items-center gap-2">
                <span className="text-white">{account.full_name ?? 'Client'}</span>
                {account.job_title ? <span className="text-neutral-500">{account.job_title}</span> : null}
                {account.is_primary ? <Pill tone="brand">Primary</Pill> : null}
                <Pill tone={account.state === 'active' ? 'good' : 'neutral'}>{account.state}</Pill>
              </li>
            ))}
          </ul>
        )}
        <DeskForm action={inviteClientAction.bind(null, file.id)} className="flex flex-wrap items-center gap-2">
          <input name="email" type="email" required placeholder="Email" aria-label="Client email" className={field} />
          <input name="full_name" placeholder="Name" aria-label="Client name" className={field} />
          <input name="job_title" placeholder="Role" aria-label="Client role" className={field} />
          <button type="submit" className={secondary}>
            Invite to the client portal
          </button>
        </DeskForm>
      </Section>
      <Section
        title="GHL location"
        aside={
          <Link href="/workspace/team/ghl" className="text-sm text-brand-200 hover:text-white">
            GHL connections
          </Link>
        }
      >
        {access.ghl ? (
          <dl className="grid gap-3 sm:grid-cols-3">
            <Fact label="Sub-account">{access.ghl.location_name ?? access.ghl.location_id}</Fact>
            <Fact label="Location id">{access.ghl.location_id}</Fact>
            <Fact label="Time zone">{access.ghl.location_time_zone ?? '—'}</Fact>
          </dl>
        ) : (
          <p className="text-sm text-neutral-500">No GHL sub-account is connected to this client. Connect it from GHL, or in the placement wizard.</p>
        )}
      </Section>
    </>
  );
}

async function Growth({ file }: { file: ClientFile }) {
  const [health, baseline, growth, snapshots, evidence, reports] = await Promise.all([
    getHealth(file.id),
    getBaseline(file.id),
    getGrowth(file.id),
    listSnapshots(file.id),
    listEvidence(file.id),
    listReports(file.id),
  ]);
  const locked = Boolean(baseline?.snapshot.locked_at);
  const screen = (name: string) => `/workspace/growth/${file.slug}/${name}`;
  const links = [
    { href: screen('baseline'), label: 'Baseline', hint: baseline ? (locked ? 'Locked' : 'Open for editing') : 'Not captured' },
    { href: screen('progress'), label: 'Snapshots', hint: `${snapshots.length} taken` },
    { href: screen('evidence'), label: 'Evidence', hint: `${evidence.length} items` },
    { href: screen('reports'), label: 'Growth reports', hint: `${reports.length} generated` },
    { href: screen('milestones'), label: 'Milestones', hint: 'Events' },
    { href: screen('effort'), label: 'Effort', hint: 'Time logged' },
    { href: screen('scope'), label: 'Scope', hint: `${health?.out_of_scope_count ?? 0} out of scope` },
  ];
  return (
    <>
      {!baseline ? (
        <Section title="No baseline captured" hint="Growth reporting stays off until the baseline is captured, during the audit and before anything is installed.">
          <Link href={screen('baseline')} className={primary}>
            Capture the baseline
          </Link>
        </Section>
      ) : !locked ? (
        <Section title="Baseline open" hint="Snapshots start once the install begins. Beginning the install locks the baseline for good.">
          <BeginInstallButton caseFileId={file.id} slug={file.slug} />
        </Section>
      ) : growth.some((row) => row.improved !== null) ? (
        <Section title="Better off than when we started?" hint={health?.last_period_end ? `Measured to ${health.last_period_end}.` : undefined}>
          <HeadlineDelta rows={growth} />
          <div className="mt-4">
            <GrowthTable rows={growth} />
          </div>
        </Section>
      ) : (
        <Section title="No progress snapshot yet" hint="Snapshots are taken weekly. EOD and booking numbers land here.">
          <Link href={screen('progress')} className={secondary}>
            Take a snapshot
          </Link>
        </Section>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="panel panel-hover rounded-2xl px-5 py-4">
            <span className="block text-sm font-medium text-white">{link.label}</span>
            <span className="text-xs text-neutral-500">{link.hint}</span>
          </Link>
        ))}
      </div>
    </>
  );
}

function Team({ file, placements }: { file: ClientFile; placements: Awaited<ReturnType<typeof listPlacements>> }) {
  return (
    <Section
      title="Placements on this client"
      aside={
        file.status !== 'ended' ? (
          <Link href={`/workspace/placements/new?client=${file.id}`} className={primary}>
            Place an operator
          </Link>
        ) : null
      }
    >
      {placements.length === 0 ? (
        <p className="text-sm text-neutral-500">No one is placed yet. The wizard opens with this client chosen; pick a Ready operator in step 1.</p>
      ) : (
        <ul className="divide-y divide-white/[0.06]">
          {placements.map((placement) => (
            <li key={placement.id}>
              <Link href={`/workspace/placements/${placement.id}`} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span className="text-white">{operatorName(placement.operator)}</span>
                <span className="flex items-center gap-2 text-neutral-400">
                  <Pill tone={placement.status === 'active' ? 'good' : placement.status === 'ended' ? 'neutral' : 'warn'}>{String(placement.status)}</Pill>
                  {placement.start_date}
                  {placement.closed_on ? ` – ${placement.closed_on}` : ''}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

async function Delivery({ file }: { file: ClientFile }) {
  const delivery = await loadClientDelivery(file.id);
  return (
    <>
      <Section title="Client reports" hint="Draft, review, send. Open one to review it.">
        {delivery.reports.length === 0 ? (
          <p className="text-sm text-neutral-500">No reports yet.</p>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {delivery.reports.map((report) => (
              <li key={report.id}>
                <Link href={`/workspace/review/reports/${report.id}`} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <span className="text-white">
                    {report.kind === 'daily' ? 'Daily' : 'Weekly'} · {report.period_start} – {report.period_end}
                    <span className="text-neutral-500"> · {report.operator ?? 'Operator'}</span>
                  </span>
                  <span className="flex items-center gap-2 text-neutral-400">
                    <Pill tone={report.status === 'sent' ? 'good' : report.status === 'failed' || report.status === 'held' ? 'bad' : 'warn'}>{report.status}</Pill>
                    {report.sent_at ? `sent ${when(report.sent_at)}` : ''}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="EODs" hint="The last 30 filed across every seat on this client.">
        {delivery.eods.length === 0 ? (
          <p className="text-sm text-neutral-500">No EODs yet.</p>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {delivery.eods.map((eod) => (
              <li key={eod.id}>
                <Link href={`/workspace/review/eods/${eod.id}`} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <span className="text-white">
                    {eod.work_date} <span className="text-neutral-500">· {eod.operator ?? 'Operator'}</span>
                  </span>
                  <Pill tone={eod.status === 'missed' ? 'bad' : eod.was_late || eod.status === 'late' ? 'warn' : 'good'}>{eod.status}</Pill>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
