import type { Metadata } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import '../acq/acq.css';
import './go.css';
import { GoPixel } from './components/GoPixel';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-acq-jakarta',
  display: 'swap',
});

const interDisplay = Inter({
  subsets: ['latin'],
  variable: '--font-acq-inter-display',
  display: 'swap',
});

const title = 'Divine Acquisition | Grow Your Residential & Remote Cleaning Business On Autopilot';
const description =
  'Missed-call booking, quote follow-up, and recurring conversion for remote residential cleaning companies. $397/month. Live in 14 days.';

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  metadataBase: new URL('https://go.divineacquisition.io'),
  alternates: { canonical: 'https://go.divineacquisition.io/' },
  openGraph: {
    title: 'Divine Acquisition | More recurring cleans from the leads you already buy',
    description:
      'We install the booking and follow-up backend so Facebook and Google leads stop dying in voicemail. Keep Jobber or Housecall Pro.',
    url: 'https://go.divineacquisition.io/',
    siteName: 'Divine Acquisition',
    images: [{ url: '/icon-512.png', width: 512, height: 512, alt: 'Divine Acquisition' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Divine Acquisition | More recurring cleans from the leads you already buy',
    description:
      'We install the booking and follow-up backend so Facebook and Google leads stop dying in voicemail. Keep Jobber or Housecall Pro.',
  },
  robots: { index: true, follow: true },
};

export default function GoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${plusJakarta.variable} ${interDisplay.variable} acq-surface`}>
      <link rel="preconnect" href="https://fast.wistia.net" />
      <link rel="preconnect" href="https://fast.wistia.com" />
      <link rel="preconnect" href="https://embed-ssl.wistia.com" />
      <GoPixel />
      {children}
    </div>
  );
}
