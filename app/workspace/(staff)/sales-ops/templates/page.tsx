import { redirect } from 'next/navigation';
import TemplateEditor from '../components/TemplateEditor';
import { controlRpc, readable } from '@/lib/ad/rpc';
import { salesOpsRole } from '@/lib/workspace/sales-ops-queries';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '../../components/ui';

export default async function TemplatesPage() {
  if ((await salesOpsRole()) !== 'admin') redirect('/workspace/sales-ops/placements');
  const supabase = await createClient();
  const { data, error } = await controlRpc<Parameters<typeof TemplateEditor>[0]['templates']>(supabase, 'so_template_list');
  return (
    <>
      <PageHeader
        title="Placement templates"
        description="A template prefills the wizard. It does not create a placement until someone confirms the steps."
      />
      {error || !data ? <p className="text-sm text-amber-200">{error ? readable(error) : 'Templates did not load.'}</p> : <TemplateEditor templates={data} />}
    </>
  );
}
