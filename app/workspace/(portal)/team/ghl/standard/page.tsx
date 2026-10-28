import type { Metadata } from 'next';
import type { Standard } from '@/lib/ghl/types';
import { Refused, teamRead } from '../../teamRead';
import StandardView from '../StandardView';

export const metadata: Metadata = { title: 'GHL standard' };
export const dynamic = 'force-dynamic';

export default async function Page() {
  const { data, error } = await teamRead<Standard>('ghl_standard');
  return error || !data ? <Refused error={error ?? 'Not available.'} /> : <StandardView standard={data} />;
}
