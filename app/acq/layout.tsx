import type { Metadata } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import './acq.css';

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
    absolute: 'Performance Pilot | Divine Acquisition',
    default: 'Performance Pilot | Divine Acquisition',
    template: '%s | Divine Acquisition',
  },
  description:
    'Info businesses don’t lose money on ads. They lose it between the call booked and the cash collected. We build and structure the boring parts between booked call and client completion.',
  alternates: {
    canonical: 'https://acq.divineacquisition.io/',
  },
  openGraph: {
    title: 'Divine Acquisition Performance Pilot',
    description:
      'That gap between the call booked and the cash collected is a sales operations problem — and it’s what we build.',
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
    title: 'Divine Acquisition Performance Pilot',
    description:
      'That gap between the call booked and the cash collected is a sales operations problem — and it’s what we build.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function AcqLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${plusJakarta.variable} ${interDisplay.variable} acq-surface`}>
      {children}
    </div>
  );
}
