import type { Metadata } from 'next';
import ForgotPasswordScreen from '@/app/components/auth/ForgotPasswordScreen';
import { requestAdReset } from '@/lib/auth/passwordActions';

export const metadata: Metadata = { title: 'Forgot your password', robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ link?: string }> }) {
  const { link } = await searchParams;
  return <ForgotPasswordScreen action={requestAdReset} linkExpired={link === 'expired'} backHref="/ad" />;
}
