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
    "Turn the leads you're paying for into booked, held calls, built for you in 14 days. We rebuild intake, scoring, follow-up, and call prep so your team carries more leads without another hire.",
  alternates: {
    canonical: 'https://acq.divineacquisition.io/',
  },
  openGraph: {
    title: 'Divine Acquisition | Founding Install',
    description:
      "Turn the leads you're paying for into booked, held calls, built for you in 14 days. We rebuild intake, scoring, follow-up, and call prep so your team carries more leads without another hire.",
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
      "Turn the leads you're paying for into booked, held calls, built for you in 14 days. We rebuild intake, scoring, follow-up, and call prep so your team carries more leads without another hire.",
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
