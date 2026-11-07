import { redirect } from 'next/navigation';
import { controlRpc, readable } from '@/lib/ad/rpc';
import { salesOpsRole } from '@/lib/workspace/sales-ops-queries';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '../../components/ui';
import PlacementWizard, { type WizardPrefill } from './PlacementWizard';

export default async function NewPlacement({ draftId, prefill }: { draftId?: string; prefill?: WizardPrefill }) {
  const role = await salesOpsRole();
  if (!role) redirect('/workspace/placements');
  const supabase = await createClient();
  const { data, error } = await controlRpc<Parameters<typeof PlacementWizard>[0]['bundle']>(supabase, 'so_wizard_bundle', {
    p_id: draftId || null,
  });
  return (
    <>
      <PageHeader
        title={draftId ? 'Continue placement' : 'New placement'}
        description="Ten steps, saved as a draft. Nothing is activated until the launch checklist is met."
      />
      {error || !data ? <p className="text-sm text-amber-200">{error ? readable(error) : 'The wizard did not load.'}</p> : <PlacementWizard bundle={data} prefill={prefill} />}
    </>
  );
}
