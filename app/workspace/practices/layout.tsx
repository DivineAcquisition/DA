import { Plus_Jakarta_Sans } from 'next/font/google';
import type { Metadata } from 'next';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Practices',
  description: 'Audit, debrief, and kickoff requirements for each practice.',
};

export default function PracticesSectionLayout({ children }: { children: React.ReactNode }) {
  return <div className={plusJakarta.variable}>{children}</div>;
}
