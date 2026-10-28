import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ViewAsButton } from '@/app/vistrial/components/ViewAs';
import { CERT_LABEL, PLACEMENT_TYPE_LABEL, formatCount, type TeamMetric } from '@/lib/sales-workspace/team';
import { STATUS_LABEL, shiftLabel, statusFromDb } from '@/lib/sales-workspace/view';
import { loadOperator } from '@/lib/sales-workspace/team-data';
import { CertPill, EodPill, ShiftPill, When } from '../../components/Bits';
import { MessageForm, TargetForm, TaskForm } from '../../components/Forms';

export const metadata: Metadata = { title: 'Operator' };
export const dynamic = 'force-dynamic';

export default async function OperatorDetailPage({ params }: { params: Promise<{ operatorId: string }> }) {
  const { operatorId } = await params;
  const { data, error } = await loadOperator(operatorId);
  if (error?.includes('not on the roster')) notFound();
  if (error || !data) {
    return <p className="panel rounded-2xl px-5 py-4 text-sm text-flag-critical">{error ?? 'This operator did not load.'}</p>;
  }
  const { operator, placement } = data;
  const limit =
    data.override_min_pct == null && data.override_max_pct == null
      ? 'No floor or ceiling is set.'
      : `Managers stay between ${data.override_min_pct ?? 'no floor'}% and ${data.override_max_pct ?? 'no ceiling'}% of the default.`;

  return (
    <div className="space-y-5">
      <header className="panel rounded-2xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-white">{operator.name}</h1>
            <p className="mt-1 text-sm text-neutral-400">
              {[operator.email, operator.phone, operator.handle].filter(Boolean).join(' · ') || 'No contact details on file.'}
            </p>
          </div>
          <ViewAsButton operatorId={operator.id} name={operator.name} hasAccount={operator.has_account} label="operator" />
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Fact label="Certification">
            {operator.certification_level ? `Level ${operator.certification_level}` : CERT_LABEL[operator.certification]}
            <span className="ml-2">
              <CertPill status={operator.certification} />
            </span>
          </Fact>
          <Fact label="Re-certify">{operator.recertify_on ?? 'No date'}</Fact>
          <Fact label="Placement">{placement ? STATUS_LABEL[statusFromDb(placement.status)] : 'None'}</Fact>
          <Fact label="Client">{placement?.client_name ?? '—'}</Fact>
          <Fact label="Type">{placement ? PLACEMENT_TYPE_LABEL[placement.placement_type] ?? placement.placement_type : '—'}</Fact>
          <Fact label="Manager">{placement?.manager_name ?? '—'}</Fact>
          <Fact label="Shift">
            {placement ? (
              <span>
                {shiftLabel(placement)} <ShiftPill status={placement.shift_status} />
              </span>
            ) : (
              '—'
            )}
          </Fact>
          <Fact label="EOD deadline">{placement ? `${placement.eod_deadline} ${placement.time_zone}` : '—'}</Fact>
          <Fact label="Placement start">{placement?.start_date ?? '—'}</Fact>
          <Fact label="Review date">{placement?.review_on ?? '—'}</Fact>
        </dl>
      </header>

      <Section title="Today and this week">
        <Numbers title="Today" metrics={data.today} isAdmin={data.is_admin} />
        <Numbers title="This week" metrics={data.week} isAdmin={data.is_admin} trend />
        <div className="mt-4 flex h-16 items-end gap-1">
          {data.days.map((day) => (
            <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-sm bg-brand-500/70"
                style={{ height: `${Math.max(4, Math.min(48, (day.conversations ?? 0) * 4))}px` }}
                title={`${day.date}: ${day.conversations ?? 0}`}
              />
            </div>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-neutral-500">Conversations, last 7 days.</p>
      </Section>

      <Section title="Quick log">
        {data.quick_log.length === 0 ? (
          <p className="text-sm text-neutral-500">No number changes yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {data.quick_log.map((change, index) => (
              <li key={`${change.at}-${index}`} className="flex flex-wrap justify-between gap-2 border-b border-white/[0.06] pb-2">
                <span className="text-white">
                  {change.label}: {formatCount(change.previous)} → {formatCount(change.value)}
                  {data.is_admin && change.source === 'ghl' ? <span className="ml-2 text-xs text-neutral-500">GHL</span> : null}
                </span>
                <span className="text-neutral-500">
                  <When iso={change.at} operatorZone={placement?.time_zone} /> {change.by ? `· ${change.by}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Tasks">
        <TaskList tasks={data.tasks} />
        <TaskForm operatorId={operator.id} placementId={placement?.id ?? null} />
      </Section>

      <Section title="Alerts">
        {data.alerts.length === 0 ? (
          <p className="text-sm text-neutral-500">No alerts yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {data.alerts.map((alert) => (
              <li key={alert.id} className="border-b border-white/[0.06] pb-2">
                <p className="text-white">{alert.title}</p>
                <p className="text-neutral-400">{alert.body}</p>
                <p className="text-xs text-neutral-500">
                  <When iso={alert.created_at} /> · {alert.read_at ? 'Read' : 'Unread'}
                  {alert.from ? ` · ${alert.from}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
        <MessageForm operatorId={operator.id} placementId={placement?.id ?? null} />
      </Section>

      <Section title="Targets">
        <p className="mb-3 text-sm text-neutral-400">{limit}</p>
        {data.targets.length === 0 ? (
          <p className="text-sm text-neutral-500">No targets on this placement.</p>
        ) : (
          <ul className="space-y-3">
            {data.targets.map((target) => (
              <li key={target.metric_key} className="border-b border-white/[0.06] pb-3">
                <p className="text-sm font-medium text-white">{target.label}</p>
                <p className="text-xs text-neutral-500">
                  {target.layer === 'override' ? 'Manager override' : target.layer === 'default' ? 'Admin default' : 'No target'}
                  {target.set_by ? ` · ${target.set_by}` : ''}
                  {target.set_at ? ` · ${target.set_at.slice(0, 10)}` : ''}
                  {target.default_daily != null ? ` · default ${formatCount(target.default_daily)} / day` : ''}
                </p>
                {placement ? <TargetForm placementId={placement.id} target={target} /> : null}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="EODs">
        {data.eods.length === 0 ? (
          <p className="text-sm text-neutral-500">No EODs yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {data.eods.map((eod) => (
              <li key={eod.id}>
                <Link href={`/vistrial/team/workspace/eods/${eod.id}`} className="flex flex-wrap items-center justify-between gap-2 text-white">
                  <span>
                    {eod.work_date} · {eod.client_name}
                  </span>
                  <span className="flex items-center gap-2">
                    <EodPill status={eod.status} wasLate={eod.was_late} />
                    <span className="text-xs text-neutral-500">{eod.feedback_count} feedback</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Placements">
        <ul className="space-y-2 text-sm">
          {data.placements.map((item) => (
            <li key={item.id} className="flex justify-between gap-3 text-neutral-300">
              <span className="text-white">{item.client_name}</span>
              <span>
                {STATUS_LABEL[statusFromDb(item.status)] ?? item.status} · {item.start_date}
                {item.closed_on ? ` – ${item.closed_on}` : item.end_date ? ` – ${item.end_date}` : ''}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      {data.is_admin && data.mismatches ? (
        <Section title="Mismatches">
          {data.mismatches.length === 0 ? (
            <p className="text-sm text-neutral-500">No mismatches.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {data.mismatches.map((row) => (
                <li key={row.id} className="flex flex-wrap justify-between gap-2">
                  <span className="text-white">
                    {row.work_date} · {row.label}
                  </span>
                  <span className="text-neutral-400">
                    Logged {formatCount(row.operator_value)} · GHL {formatCount(row.ghl_value)} · gap {formatCount(row.gap)} · {row.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      ) : null}
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</dt>
      <dd className="mt-1 text-white">{children}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel rounded-2xl p-5">
      <h2 className="mb-3 text-base font-semibold text-white">{title}</h2>
      {children}
    </section>
  );
}

function Numbers({
  title,
  metrics,
  isAdmin,
  trend = false,
}: {
  title: string;
  metrics: Array<TeamMetric & { previous?: number | null; trend?: 'up' | 'down' | 'flat' | null }>;
  isAdmin: boolean;
  trend?: boolean;
}) {
  return (
    <div className="mb-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">{title}</h3>
      {metrics.length === 0 ? (
        <p className="text-sm text-neutral-500">No numbers for this placement.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-[11px] uppercase text-neutral-500">
              <tr>
                <th className="pb-2 font-medium">Metric</th>
                <th className="pb-2 font-medium">Logged</th>
                {isAdmin ? <th className="pb-2 font-medium">GHL</th> : null}
                <th className="pb-2 font-medium">Target</th>
                {trend ? <th className="pb-2 font-medium">Vs last week</th> : null}
              </tr>
            </thead>
            <tbody>
              {metrics.map((metric) => (
                <tr key={metric.key} className="border-t border-white/[0.06]">
                  <td className="py-2 text-white">{metric.label}</td>
                  <td className="py-2 tabular-nums">{formatCount(metric.operator)}</td>
                  {isAdmin ? (
                    <td className="py-2 text-neutral-300">{metric.ghl == null ? 'Pending sync' : formatCount(metric.ghl)}</td>
                  ) : null}
                  <td className="py-2 text-neutral-400">
                    {metric.daily_target == null && metric.weekly_target == null
                      ? '—'
                      : `${formatCount(metric.daily_target)} / ${formatCount(metric.weekly_target)}`}
                  </td>
                  {trend ? (
                    <td className="py-2 text-neutral-400">
                      {metric.trend == null ? '—' : metric.trend === 'up' ? 'Up' : metric.trend === 'down' ? 'Down' : 'Flat'}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TaskList({ tasks }: { tasks: { id: string; title: string; detail: string | null; due_on: string | null; completed_on: string | null; overdue: boolean }[] }) {
  if (tasks.length === 0) return <p className="text-sm text-neutral-500">No tasks.</p>;
  const groups = [
    ['Overdue', tasks.filter((task) => task.overdue)],
    ['Open', tasks.filter((task) => !task.completed_on && !task.overdue)],
    ['Done', tasks.filter((task) => task.completed_on)],
  ] as const;
  return (
    <div className="space-y-3">
      {groups.map(([label, items]) =>
        items.length === 0 ? null : (
          <div key={label}>
            <p className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</p>
            <ul className="mt-1 space-y-1 text-sm">
              {items.map((task) => (
                <li key={task.id} className="text-white">
                  {task.title}
                  <span className="text-neutral-500">
                    {task.due_on ? ` · due ${task.due_on}` : ''}
                    {task.completed_on ? ` · done ${task.completed_on}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ),
      )}
    </div>
  );
}
