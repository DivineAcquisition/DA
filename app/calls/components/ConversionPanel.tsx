import Link from 'next/link';
import { btnPrimary, btnSizeSm } from '@/app/components/ui';
import { Badge, Panel } from '@/app/vistrial/components/ui';
import {
  clientBaseUrl,
  formatClosedWonLabel,
  type OnboardCta,
} from '@/lib/calls/conversion';
import { formatDisplayDate, todayInCallsZone } from '@/lib/calls/map';
import type { Conversion, OnboardingRecord } from '@/lib/calls/types';
import ConfirmPaymentForm from './ConfirmPaymentForm';
import RecordClientBaseForm from './RecordClientBaseForm';

export default function ConversionPanel({
  conversion,
  cta,
  leadId,
  onboarding,
}: {
  conversion: Conversion;
  cta: OnboardCta;
  leadId: string;
  onboarding: OnboardingRecord | null;
}) {
  if (cta.kind === 'none') return null;

  const statusLabel = formatClosedWonLabel(conversion.closedWonAt);

  return (
    <Panel className="border-flag-good/20 bg-flag-good/[0.06] px-5 py-5 sm:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="good">{statusLabel}</Badge>
        {conversion.paymentConfirmed ? (
          <Badge tone="good">Paid</Badge>
        ) : (
          <Badge tone="warning">Waiting on Commas</Badge>
        )}
        {onboarding?.submitted && (
          <Badge>Onboarding {formatDisplayDate(onboarding.submitted)}</Badge>
        )}
      </div>

      {cta.kind === 'waiting-payment' && (
        <div className="mt-4 space-y-3">
          <p className="text-sm leading-relaxed text-neutral-200">
            Closed Won marks them ready. Onboarding does not start from the debrief — payment
            clears in Commas first. There is no Commas webhook; confirm it here once you see it.
          </p>
          <ConfirmPaymentForm leadId={leadId} />
        </div>
      )}

      {cta.kind === 'start' && (
        <div className="mt-4 space-y-3">
          <p className="text-sm leading-relaxed text-neutral-200">
            Payment is on the lead as Paid. Start onboarding when you are ready — it opens the
            form already filled from this profile and the closing debrief.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href={`/calls/${leadId}/onboard`} className={`${btnPrimary} ${btnSizeSm}`}>
              Start Onboarding
            </Link>
          </div>
          <RecordClientBaseForm leadId={leadId} today={todayInCallsZone()} />
        </div>
      )}

      {cta.kind === 'client-base' && (
        <div className="mt-4 space-y-2">
          <p className="text-sm leading-relaxed text-neutral-200">
            This profile stays here as how we acquired them. Their operating base is separate.
          </p>
          <p className="text-sm">
            <a
              href={clientBaseUrl(cta.base.id)}
              className="font-medium text-brand-300 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              {cta.base.name || 'Open client base'}
            </a>
            {cta.base.created ? (
              <span className="text-neutral-500"> · created {formatDisplayDate(cta.base.created)}</span>
            ) : null}
          </p>
        </div>
      )}
    </Panel>
  );
}
