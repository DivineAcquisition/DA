import type { Metadata } from 'next';
import SetPasswordScreen from '@/app/components/auth/SetPasswordScreen';
import { saveAdPassword } from '@/lib/auth/passwordActions';

export const metadata: Metadata = { title: 'Set a new password', robots: { index: false, follow: false } };

export default function Page() {
  return <SetPasswordScreen action={saveAdPassword} />;
}
