import type { Metadata } from 'next';
import { Geist_Mono } from 'next/font/google';
import { RoofingPixel } from '@/app/acq/components/RoofingPixel';
import { interDisplay } from '@/app/fonts/inter-display';
import { ROOFING } from '@/lib/acq/niche-content';
import '@/app/site/site.css';

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { absolute: ROOFING.meta.title },
  description: ROOFING.meta.description,
  keywords: ['roofing contractors', 'lead leak audit'],
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
  alternates: { canonical: 'https://acq.divineacquisition.io/roofing' },
  openGraph: {
    title: ROOFING.meta.title,
    description: ROOFING.meta.description,
    url: 'https://acq.divineacquisition.io/roofing',
    siteName: 'Divine Acquisition',
  },
  twitter: {
    card: 'summary',
    title: ROOFING.meta.title,
    description: ROOFING.meta.description,
  },
};

export default function RoofingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${interDisplay.variable} ${geistMono.variable} da-site min-h-screen`}>
      <RoofingPixel />
      {children}
    </div>
  );
}
