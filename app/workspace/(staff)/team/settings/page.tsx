import type { Metadata } from 'next';
import type { AccountabilitySettings } from '@/lib/team/types';
import SettingsView from '../SettingsView';
import { Refused, teamRead } from '../teamRead';

export const metadata: Metadata = { title: "Settings" };
export const dynamic = 'force-dynamic';

export default async function Page() {
  const { data, error } = await teamRead<AccountabilitySettings>('staff_accountability_settings');
  return (
    <>
      {error || !data ? <Refused error={error ?? 'Not available.'} /> : <SettingsView data={data} />}
    </>
  );
}
