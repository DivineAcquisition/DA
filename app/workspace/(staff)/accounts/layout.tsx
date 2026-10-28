import type { ReactNode } from 'react';
import { Plus_Jakarta_Sans } from 'next/font/google';
import type { Metadata } from 'next';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Accounts',
  description: 'Audit, debrief, and kickoff requirements. Forms follow the selected niche.',
};

export default function AccountsSectionLayout({ children }: { children: ReactNode }) {
  return <div className={plusJakarta.variable}>{children}</div>;
}
