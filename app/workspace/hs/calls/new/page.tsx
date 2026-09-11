import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function HsNewCallRedirect() {
  redirect('/workspace/calls/new');
}
