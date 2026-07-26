import type { Metadata } from 'next';
import { OpsProvider } from '@/lib/vistrial/store';
import AppShell from './components/AppShell';

export const metadata: Metadata = {
  title: {
    default: 'Vistrial — VA Ops Hub',
    template: '%s | Vistrial Ops',
  },
  description: 'Internal operations hub for the operators Divine Acquisition trains and places.',
  // Rule 7: the client never has access to any of this, and neither do crawlers.
  robots: { index: false, follow: false, nocache: true },
};

export default function VistrialLayout({ children }: { children: React.ReactNode }) {
  return (
    <OpsProvider>
      <AppShell>{children}</AppShell>
    </OpsProvider>
  );
}
