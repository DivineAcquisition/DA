import type { Metadata } from 'next';
import type { Unattributed } from '@/lib/ghl/types';
import { Refused, teamRead } from '../../teamRead';
import UnattributedView from '../UnattributedView';

export const metadata: Metadata = { title: 'Unattributed events' };
export const dynamic = 'force-dynamic';

export default async function Page() {
  const { data, error } = await teamRead<Unattributed>('ghl_unattributed');
  return error || !data ? <Refused error={error ?? 'Not available.'} /> : <UnattributedView data={data} />;
}
