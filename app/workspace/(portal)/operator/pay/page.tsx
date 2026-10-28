import type { Metadata } from 'next';
import { loadPortal } from '@/lib/portal/load';
import type { Statement } from '@/lib/portal/types';
import { renderPortal } from '../components/frame';
import PayView from '../components/PayView';
import { GrowthNav } from '../components/RecordNav';

export const metadata: Metadata = { title: 'Pay' };
export const dynamic = 'force-dynamic';

export default async function PayPage() {
  const load = await loadPortal<{ statements: Statement[] }>('pay', async (rpc) => {
    const result = await rpc<{ statements: Statement[] }>('portal_pay');
    // A manager viewing as the VA: pay is not theirs to see.
    if (result.error && /pay is not available/.test(result.error)) {
      return { data: null, error: 'Pay is not available to your role.' };
    }
    return result;
  });
  return renderPortal(load, 'pay', (data, _placementId, context) => (
    <>
      {context.stage === 'inactive' ? null : <GrowthNav current="pay" />}
      <PayView statements={data.statements} />
    </>
  ));
}
