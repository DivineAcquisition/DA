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
    images: [{ url: '/site/og.png', width: 1200, height: 630, alt: HERO.headline }],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description: HERO.lead,
    creator: '@maliksannie',
    images: ['/site/og.png'],
  },
  robots: { index: true, follow: true },
  manifest: '/site/manifest.json',
  icons: {
    icon: [
      { url: '/site/icons/favicon.ico', sizes: '16x16 32x32 48x48' },
      { url: '/site/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/site/icons/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/site/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/site/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    shortcut: '/site/icons/favicon.ico',
  },
  appleWebApp: { title: 'Divine Acquisition', statusBarStyle: 'black-translucent' },
};

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${jakarta.variable} ${fragmentMono.variable} da-site min-h-screen`}>{children}</div>;
}
