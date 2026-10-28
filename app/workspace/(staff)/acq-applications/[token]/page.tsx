import Link from 'next/link';
import { notFound } from 'next/navigation';
import { storedApplication } from '@/lib/acq/application-server';
import { applicationBadge } from '@/lib/acq/application-pdf';
import { APPLY_QUESTIONS } from '@/lib/acq/application-copy';

export const dynamic = 'force-dynamic';

export default async function ApplicationCasePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const record = storedApplication(token);
  if (!record) notFound();
  const delivery = record.delivery;

  return (
    <main className="mx-auto max-w-3xl px-5 py-8 text-white">
      <p className="text-sm text-neutral-400">
        <Link href="/workspace/acq-applications">Application counts</Link>
      </p>
      <h1 className="mt-3 text-2xl font-semibold">{record.contact.firstName}</h1>
      <p className="mt-1 text-sm text-neutral-300">{record.route ? applicationBadge(record) : 'In progress'}</p>
      <dl className="mt-6 grid gap-3 text-sm">
        {APPLY_QUESTIONS.map((question) => (
          <div key={question.key}>
            <dt className="text-neutral-400">{question.prompt}</dt>
            <dd>{record.answers[question.key] || 'Not answered'}</dd>
          </div>
        ))}
        <div>
          <dt className="text-neutral-400">Source ad</dt>
          <dd>{record.sourceAd || 'direct'}</dd>
        </div>
        <div>
          <dt className="text-neutral-400">SMS consent</dt>
          <dd>{record.contact.smsConsent ? 'yes' : 'no'}</dd>
        </div>
      </dl>
      <h2 className="mt-8 text-lg font-semibold">Delivery</h2>
      <ul className="mt-3 space-y-1 text-sm">
        {delivery
          ? (['ghl', 'pdf', 'vistrial', 'airtable', 'email', 'text'] as const).map((key) => (
              <li key={key}>
                {key}: {delivery[key].status}
                {delivery[key].error ? ` (${delivery[key].error})` : ''}
              </li>
            ))
          : <li>Not delivered yet.</li>}
      </ul>
      {delivery?.caseFileUrl ? (
        <p className="mt-4 text-sm">
          Case file: <a href={delivery.caseFileUrl}>{delivery.caseFileUrl}</a>
        </p>
      ) : null}
      {delivery?.pdf.status === 'done' ? (
        <p className="mt-4">
          <a className="rounded-md bg-white px-3 py-2 text-sm text-black" href={`/workspace/acq-applications/${token}/pdf`}>
            Open PDF
          </a>
        </p>
      ) : null}
    </main>
  );
}
