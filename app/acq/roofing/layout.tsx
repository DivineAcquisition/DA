import type { Metadata } from 'next';
import { RoofingPixel } from '@/app/acq/components/RoofingPixel';
import { ROOFING } from '@/lib/acq/niche-content';
import './niche.css';

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
    <>
      <RoofingPixel />
      {children}
    </>
  );
}
