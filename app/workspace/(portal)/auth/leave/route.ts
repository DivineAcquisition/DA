import { NextResponse, type NextRequest } from 'next/server';
import { appUrl } from '@/lib/apps';
import { loadOperatorWorkspaceDomain } from '@/lib/operator-workspace/domain';
import { createClient } from '@/lib/supabase/server';

/**
 * The handoff between the two apps. A person signed into the wrong app is
 * signed out here (each app has its own session) and sent to the app they
 * belong to, to sign in there.
 */
export async function GET(request: NextRequest) {
  const to = request.nextUrl.searchParams.get('to') === 'team' ? 'team' : 'admin';
  const supabase = await createClient();
  await supabase.rpc('end_impersonation');
  await supabase.auth.signOut({ scope: 'local' });
  const team = (await loadOperatorWorkspaceDomain()).origin || appUrl('team');
  return NextResponse.redirect(to === 'admin' ? `${appUrl('admin')}/workspace` : `${team}/`);
}
