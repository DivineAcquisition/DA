import type { Metadata } from 'next';
import ForgotPasswordScreen from '@/app/components/auth/ForgotPasswordScreen';
import { currentApp } from '@/lib/appsServer';
import { hubResetRequestAction } from '@/lib/vistrial/authActions';

export const metadata: Metadata = {
  title: 'Forgot your password',
  robots: { index: false, follow: false },
};

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ link?: string }> }) {
  const { link } = await searchParams;
  const app = await currentApp();
  return (
    <ForgotPasswordScreen
      action={hubResetRequestAction}
      linkExpired={link === 'expired'}
      backHref={app === 'team' ? '/workspace/operator' : '/workspace/login'}
    />
  );
}
