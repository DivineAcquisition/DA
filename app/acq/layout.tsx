import type { Metadata } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import './acq.css';
import { MetaPixel } from './components/MetaPixel';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  style: ['normal', 'italic'],
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
    'We install the retention system that cuts month-2 churn 25-35% in the first membership cycle, without you chasing a single member. Built in 30 days for $4,500.',
  alternates: {
    canonical: 'https://acq.divineacquisition.io/',
  },
  openGraph: {
    title: 'Divine Acquisition | Founding Install',
    description:
      'We install the retention system that cuts month-2 churn 25-35% in the first membership cycle, without you chasing a single member. Built in 30 days for $4,500.',
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
    title: 'Divine Acquisition | Founding Install',
    description:
      'We install the retention system that cuts month-2 churn 25-35% in the first membership cycle, without you chasing a single member. Built in 30 days for $4,500.',
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
