import { redirect } from 'next/navigation';
import { getSessionContext } from '@/lib/supabase/server';

/**
 * Each app's home. The team app opens the VA's stage-based home; the admin app
 * opens the operations overview. The layout has already decided who may be here.
 */
export default async function VistrialHome() {
  const session = await getSessionContext();
  redirect(session?.role === 'operator' ? '/vistrial/operator' : '/vistrial/ops');
}
