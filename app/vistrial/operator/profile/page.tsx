import type { Metadata } from 'next';
import { loadPortal } from '@/lib/portal/load';
import type { ProfileData } from '@/lib/portal/types';
import { renderPortal } from '../components/frame';
import ProfileView from '../components/ProfileView';

export const metadata: Metadata = { title: 'Profile' };
export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const load = await loadPortal<ProfileData>('profile', (rpc) => rpc<ProfileData>('portal_profile'));
  return renderPortal(load, 'profile', (data) => <ProfileView data={data} />);
}
