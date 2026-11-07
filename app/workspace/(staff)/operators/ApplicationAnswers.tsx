import type { Applicant } from '@/lib/operators/desk';

const LINKS: [keyof Applicant, string][] = [
  ['linkedin_url', 'LinkedIn'],
  ['portfolio_url', 'Portfolio'],
  ['loom_url', 'Loom'],
];

/** The careers form, as submitted. Shown on the applicant and on the operator file. */
export default function ApplicationAnswers({ application }: { application: Applicant }) {
  return (
    <div className="space-y-4 text-sm">
      <dl className="grid gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-neutral-500">Email</dt>
          <dd className="mt-1 text-white">{application.email}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-neutral-500">Phone</dt>
          <dd className="mt-1 text-white">{application.phone ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-neutral-500">Availability</dt>
          <dd className="mt-1 text-white">{application.availability ?? '—'}</dd>
        </div>
      </dl>
      <div className="flex flex-wrap gap-3">
        {LINKS.map(([key, label]) =>
          application[key] ? (
            <a key={key} href={String(application[key])} target="_blank" rel="noopener noreferrer" className="text-brand-200 hover:text-white">
              {label}
            </a>
          ) : null,
        )}
      </div>
      <div>
        <h3 className="text-[11px] uppercase tracking-wide text-neutral-500">Relevant experience</h3>
        <p className="mt-1 whitespace-pre-wrap text-neutral-200">{application.experience || '—'}</p>
      </div>
      <div>
        <h3 className="text-[11px] uppercase tracking-wide text-neutral-500">Why they fit</h3>
        <p className="mt-1 whitespace-pre-wrap text-neutral-200">{application.why_you || '—'}</p>
      </div>
    </div>
  );
}
