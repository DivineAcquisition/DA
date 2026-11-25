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

const title = 'Divine Acquisition | Add 10-15 Recurring Accounts In 30-90 Days';
const description =
  "We'll help cleaning companies add 10-15 recurring accounts in 30-90 days.";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  metadataBase: new URL('https://go.divineacquisition.io'),
  alternates: { canonical: 'https://go.divineacquisition.io/' },
  openGraph: {
    title,
    description,
    url: 'https://go.divineacquisition.io/',
    siteName: 'Divine Acquisition',
    images: [{ url: '/icon-512.png', width: 512, height: 512, alt: 'Divine Acquisition' }],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
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
