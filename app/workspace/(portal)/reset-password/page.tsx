import type { Metadata } from 'next';
import SetPasswordScreen from '@/app/components/auth/SetPasswordScreen';
import { hubSetPasswordAction } from '@/lib/vistrial/authActions';

export const metadata: Metadata = {
  title: 'Set a new password',
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return <SetPasswordScreen action={hubSetPasswordAction} />;
}
