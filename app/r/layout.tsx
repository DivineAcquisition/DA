import type { Metadata } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-report' });
const inter = Inter({ subsets: ['latin'], variable: '--font-report-body' });

export const metadata: Metadata = {
  title: 'Report',
  robots: { index: false, follow: false, nocache: true },
};

export default function ReportLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${jakarta.variable} ${inter.variable} min-h-screen bg-[#f6f4fb] text-[#1a1523]`} style={{ fontFamily: 'var(--font-report-body), Inter, sans-serif' }}>
      {children}
    </div>
  );
}
