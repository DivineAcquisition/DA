import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarCheck, ClipboardList, PhoneCall, UserRound } from 'lucide-react';
import { bookingSummary, bookingTime, INQUIRY_LABEL, leadName, outcomeLabel, STAGE_LABEL, stageTone } from '@/lib/pipeline/desk';
import { loadLead } from '@/lib/pipeline/data';
import { DeskHeader, Fact, Pill, Problem, Section, when } from '../../components/desk';
import { LeadForm, LogCallForm } from './forms';

export const metadata: Metadata = { title: 'Lead' };
export const dynamic = 'force-dynamic';

function stamp(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' }) + ' CT';
}

export default async function LeadPage({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  const { data, error } = await loadLead(leadId);
  if (error || !data) {
    return (
      <div>
        <DeskHeader crumb="Pipeline" title="Lead" />
        <Problem>{error ?? 'The lead did not load.'}</Problem>
        <Link href="/workspace/pipeline" className="mt-3 inline-block text-sm text-brand-200 hover:text-white">
          Back to the pipeline
        </Link>
      </div>
    );
  }
  const { lead, booking, bookings, inquiries, calls } = data;
  const summary = bookingSummary(booking);

  return (
    <div>
      <DeskHeader
        crumb="Pipeline"
        title={leadName(lead)}
        description={[lead.full_name && lead.company ? lead.company : null, lead.source, `In since ${when(lead.created_at)}`].filter(Boolean).join(' · ')}
        actions={<Pill tone={stageTone(lead.stage)}>{STAGE_LABEL[lead.stage] ?? lead.stage}</Pill>}
      />
      <Link href="/workspace/pipeline" className="mb-4 inline-block text-[13px] text-neutral-400 hover:text-white">
        ← All leads
      </Link>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <div className="space-y-5">
          <Section title="Contact" icon={UserRound}>
            <dl className="grid gap-4 sm:grid-cols-3">
              <Fact label="Email">{lead.email ? <a className="text-brand-200 hover:text-white" href={`mailto:${lead.email}`}>{lead.email}</a> : '—'}</Fact>
              <Fact label="Phone">{lead.phone ? <a className="text-brand-200 hover:text-white" href={`tel:${lead.phone}`}>{lead.phone}</a> : '—'}</Fact>
              <Fact label="GoHighLevel">{lead.ghl_contact_id ? 'Linked' : 'Not linked yet'}</Fact>
            </dl>
          </Section>

          <Section title="Booking" icon={CalendarCheck} aside={<Pill tone={summary.tone}>{summary.label}</Pill>}>
            {bookings.length === 0 ? (
              <p className="text-sm text-neutral-400">No call on the calendar yet. When they book, it shows here within a minute.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {bookings.map((item, index) => (
                  <li key={`${item.starts_at}-${index}`} className="flex justify-between gap-3 text-neutral-300">
                    <span>{bookingTime(item.starts_at, item.time_zone) || 'No time'}</span>
                    <span className="text-neutral-500">{item.status.replace('_', ' ')}</span>
                  </li>
                ))}
              </ul>
            )}
            {booking?.meeting_link ? (
              <a href={booking.meeting_link} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm text-brand-200 hover:text-white">
                Open the meeting link
              </a>
            ) : null}
          </Section>

          <Section title="What they told us" icon={ClipboardList} hint={inquiries.length ? undefined : 'This lead came in before forms were saved here. Their answers are on the GoHighLevel contact.'}>
            {inquiries.length === 0 ? null : (
              <div className="space-y-5">
                {inquiries.map((inquiry) => (
                  <div key={inquiry.id}>
                    <p className="mb-2 text-[13px] text-neutral-400">
                      <span className="text-white">{INQUIRY_LABEL[inquiry.kind] ?? inquiry.kind}</span> · {stamp(inquiry.created_at)}
                    </p>
                    <dl className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.08]">
                      {inquiry.answers.map(([label, value], index) => (
                        <div key={`${label}-${index}`} className="grid gap-1 px-4 py-2.5 sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-4">
                          <dt className="text-[13px] text-neutral-500">{label}</dt>
                          <dd className="text-sm whitespace-pre-wrap text-white">{value || '—'}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        <div className="space-y-5 xl:sticky xl:top-20 xl:self-start">
          <Section title="Log the discovery call" icon={PhoneCall} hint="The outcome moves the stage.">
            <LogCallForm leadId={lead.id} />
            {calls.length ? (
              <ul className="mt-5 space-y-3 border-t border-white/[0.07] pt-4">
                {calls.map((call) => (
                  <li key={call.id} className="text-sm">
                    <p className="text-white">
                      {outcomeLabel(call.outcome)} <span className="text-neutral-500">· {stamp(call.occurred_at)}{call.by ? ` · ${call.by}` : ''}</span>
                    </p>
                    {call.notes ? <p className="mt-1 whitespace-pre-wrap text-neutral-300">{call.notes}</p> : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </Section>

          <Section title="Stage and next step">
            <LeadForm leadId={lead.id} stage={lead.stage} nextAction={lead.next_action ?? ''} notes={lead.notes ?? ''} />
          </Section>
        </div>
      </div>
    </div>
  );
}
