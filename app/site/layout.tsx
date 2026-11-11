import type { Metadata } from 'next';
import { Geist_Mono } from 'next/font/google';

import { interDisplay } from '@/app/fonts/inter-display';
import { HERO, SITE } from '@/lib/site/content';

import './site.css';

/** Vistrial's pairing: Inter Display for everything, Geist Mono for the small labels. */
const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
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
  return <div className={`${interDisplay.variable} ${geistMono.variable} da-site min-h-screen`}>{children}</div>;
}
