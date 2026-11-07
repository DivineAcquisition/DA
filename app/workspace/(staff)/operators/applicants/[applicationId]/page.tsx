import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { controlRpc } from '@/lib/ad/rpc';
import { isSalesOperatorRole } from '@/lib/careers/roles';
import { advanceApplicantAction, declineApplicantAction, markReviewingAction } from '@/lib/operators/actions';
import { getApplicant } from '@/lib/operators/desk';
import { createClient } from '@/lib/supabase/server';
import DeskForm from '../../../components/DeskForm';
import { DeskHeader, Fact, Pill, Section, area, danger, field, primary, secondary, when } from '../../../components/desk';
import ApplicationAnswers from '../../ApplicationAnswers';

export const metadata: Metadata = { title: 'Applicant' };
export const dynamic = 'force-dynamic';

type Options = { managers: { id: string; name: string }[]; programs: { id: string; name: string; slug: string }[] };

export default async function ApplicantPage({ params }: { params: Promise<{ applicationId: string }> }) {
  const { applicationId } = await params;
  const application = await getApplicant(applicationId);
  if (!application || !isSalesOperatorRole(application.role_slug)) notFound();

  const supabase = await createClient();
  const { data: options } = await controlRpc<Options>(supabase, 'hire_options', {});
  const programs = options?.programs ?? [];
  const academy = programs.find((program) => program.slug === 'da-operator-academy') ?? programs[0];
  const open = application.status === 'new' || application.status === 'reviewing';

  return (
    <div className="space-y-5">
      <Link href="/workspace/operators/applicants" className="text-sm text-neutral-400 hover:text-white">
        Applicants
      </Link>
      <DeskHeader
        title={application.full_name}
        description={`${application.role_title} · received ${when(application.received_at)}`}
        actions={<Pill tone={application.status === 'new' ? 'brand' : application.status === 'reviewing' ? 'warn' : 'neutral'}>{application.status}</Pill>}
      />

      {application.converted_operator_id ? (
        <p className="panel rounded-2xl px-5 py-4 text-sm text-neutral-300">
          Advanced. The hire continues on the{' '}
          <Link className="text-brand-200 hover:text-white" href={`/workspace/operators/${application.converted_operator_id}`}>
            operator file
          </Link>
          .
        </p>
      ) : null}

      <Section title="Application" hint="Read-only. This is what they sent.">
        <ApplicationAnswers application={application} />
      </Section>

      {application.review_note ? (
        <Section title="Review note">
          <p className="whitespace-pre-wrap text-sm text-neutral-200">{application.review_note}</p>
          <p className="mt-1 text-xs text-neutral-500">{when(application.reviewed_at)}</p>
        </Section>
      ) : null}

      {open ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Section title="Advance" hint="Opens the operator file at Invited, enrols them in the Academy, and emails the invite.">
            <DeskForm action={advanceApplicantAction} className="grid gap-3">
              <input type="hidden" name="application_id" value={application.id} />
              <label className="grid gap-1 text-sm text-neutral-300">
                Manager
                <select name="manager_id" required defaultValue="" className={field}>
                  <option value="" disabled>
                    Choose a manager
                  </option>
                  {(options?.managers ?? []).map((manager) => (
                    <option key={manager.id} value={manager.id}>
                      {manager.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm text-neutral-300">
                Program
                <select name="program_id" defaultValue={academy?.id ?? ''} className={field}>
                  {programs.map((program) => (
                    <option key={program.id} value={program.id}>
                      {program.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm text-neutral-300">
                Note for the file
                <textarea name="note" className={area} placeholder="Optional" />
              </label>
              <button type="submit" className={primary}>
                Advance and send the invite
              </button>
            </DeskForm>
          </Section>
          <Section title="Decline" hint="The note stays on the application.">
            <DeskForm action={declineApplicantAction} className="grid gap-3">
              <input type="hidden" name="application_id" value={application.id} />
              <textarea name="note" required minLength={3} className={area} placeholder="Why" aria-label="Why you are declining" />
              <button type="submit" className={danger}>
                Decline
              </button>
            </DeskForm>
            {application.status === 'new' ? (
              <DeskForm action={markReviewingAction} className="mt-4 flex flex-wrap gap-2 border-t border-white/[0.06] pt-4">
                <input type="hidden" name="application_id" value={application.id} />
                <button type="submit" className={secondary}>
                  Mark in review instead
                </button>
              </DeskForm>
            ) : null}
          </Section>
        </div>
      ) : (
        <dl className="grid gap-3 sm:grid-cols-3">
          <Fact label="Status">{application.status}</Fact>
          <Fact label="Reviewed">{when(application.reviewed_at)}</Fact>
        </dl>
      )}
    </div>
  );
}
