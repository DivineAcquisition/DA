import type { Metadata } from 'next';
import { controlRpc, readable } from '@/lib/ad/rpc';
import type { OnboardingDraft } from '@/lib/hire/rules';
import { createClient } from '@/lib/supabase/server';
import { WorkspaceShell } from '../shell';
import OnboardingForm from './OnboardingForm';

export const metadata: Metadata = { title: 'Onboarding' };
export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const supabase = await createClient();
  const home = await controlRpc<{
    journey: { stage: string } | null;
    answers: OnboardingDraft | null;
    payout_complete: boolean;
    ack_at: string | null;
  }>(supabase, 'hire_note_sign_in');
  if (home.error) return <p className="p-6 text-sm text-[#FFB020]">{readable(home.error)}</p>;
  if (!home.data?.journey) return <p className="p-6 text-sm text-neutral-400">Onboarding here opens after DA Admin adds you.</p>;
  return (
    <WorkspaceShell>
      <h1 className="mb-4 text-2xl font-semibold">Onboarding</h1>
      <OnboardingForm
        initial={home.data.answers ?? {}}
        payoutComplete={Boolean(home.data.payout_complete)}
        acknowledgmentsLocked={Boolean(home.data.ack_at)}
      />
    </WorkspaceShell>
  );
}
