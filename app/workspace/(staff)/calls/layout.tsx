import { Plus_Jakarta_Sans } from 'next/font/google';
import type { Metadata } from 'next';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Calls',
  description: '15-minute qualifying call workspace.',
};

export default function CallsSectionLayout({ children }: { children: React.ReactNode }) {
  return <div className={plusJakarta.variable}>{children}</div>;
}
