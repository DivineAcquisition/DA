import type { Metadata } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import './acq.css';
import { MetaPixel } from './components/MetaPixel';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-acq-jakarta',
  display: 'swap',
});

/** Inter with optical sizing — Display cut at headline/body sizes. */
const interDisplay = Inter({
  subsets: ['latin'],
  variable: '--font-acq-inter-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    absolute: 'Founding Install | Divine Acquisition',
    default: 'Founding Install | Divine Acquisition',
    template: '%s | Divine Acquisition',
  },
  description:
    "We'll build and run your sales operation systems to turn the demand you are generating into booked calls, done for you in 14 days. Founding installs for coaching businesses.",
  alternates: {
    canonical: 'https://acq.divineacquisition.io/',
  },
  openGraph: {
    title: 'Divine Acquisition — Founding Install',
    description:
      'We build and run your sales operation systems to turn demand into booked calls. Done for you in 14 days.',
    url: 'https://acq.divineacquisition.io/',
    siteName: 'Divine Acquisition',
    images: [
      {
        url: '/icon-512.png',
        width: 512,
        height: 512,
        alt: 'Divine Acquisition',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Divine Acquisition — Founding Install',
    description:
      'We build and run your sales operation systems to turn demand into booked calls. Done for you in 14 days.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function AcqLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${plusJakarta.variable} ${interDisplay.variable} acq-surface`}>
      <link rel="preconnect" href="https://fast.wistia.net" />
      <link rel="preconnect" href="https://fast.wistia.com" />
      <link rel="preconnect" href="https://embed-ssl.wistia.com" />
      <MetaPixel />
      {children}
    </div>
  );
}
