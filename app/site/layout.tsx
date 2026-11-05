import type { Metadata } from 'next';
import { Fragment_Mono, Plus_Jakarta_Sans } from 'next/font/google';

import { HERO, SITE } from '@/lib/site/content';

import './site.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-jakarta',
  display: 'swap',
});

const fragmentMono = Fragment_Mono({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-fragment',
  display: 'swap',
});

const title = 'Divine Acquisition™ | Sales Operations & Client Experience Systems';

export const metadata: Metadata = {
  title: { absolute: title },
  description: SITE.description,
  metadataBase: new URL(SITE.origin),
  alternates: { canonical: `${SITE.origin}/` },
  openGraph: {
    type: 'website',
    url: `${SITE.origin}/`,
    siteName: SITE.legalName,
    title,
    description: HERO.lead,
    images: [{ url: '/icon-512.png', width: 512, height: 512, alt: 'Divine Acquisition' }],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description: HERO.lead,
    creator: '@maliksannie',
    images: ['/icon-512.png'],
  },
  robots: { index: true, follow: true },
};

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${jakarta.variable} ${fragmentMono.variable} da-site min-h-screen`}>{children}</div>;
}
