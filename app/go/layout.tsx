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

const title = 'Divine Acquisition | Own Your Leads for Cleaning Companies';
const description =
  'Exclusive quote requests from your own ads, a first text within minutes, and a person who books the first clean on a recurring plan. You pay only when a client goes recurring.';

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
    images: [{ url: '/cleaning/finished-home.svg', alt: 'A bright finished home' }],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: ['/cleaning/finished-home.svg'],
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
