import { redirect } from 'next/navigation';
import { STAFF_HOME } from '@/lib/workspace/adminNav';

export default function WorkspaceIndexPage() {
  redirect(STAFF_HOME);
}
