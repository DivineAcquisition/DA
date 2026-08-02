import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    absolute: 'Performance Pilot | Divine Acquisition',
    default: 'Performance Pilot | Divine Acquisition',
    template: '%s | Divine Acquisition',
  },
  description:
    'We help service businesses 2-3x their client intake without hiring by automating sales conversion and repetitive tasks. You pay nothing to build it and nothing to run it. You only pay for the appointments we book.',
  alternates: {
    canonical: 'https://acq.divineacquisition.io/',
  },
  openGraph: {
    title: 'Divine Acquisition Performance Pilot',
    description:
      'Sales operations for service businesses at $30k+/month. You only pay for the appointments we book.',
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
      'Sales operations for service businesses at $30k+/month. You only pay for the appointments we book.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function AcqLayout({ children }: { children: React.ReactNode }) {
  return children;
}
