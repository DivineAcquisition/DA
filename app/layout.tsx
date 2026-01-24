import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Careers at Divine Acquisition | Join Our Team',
    template: '%s | Divine Acquisition Careers',
  },
  description: 'Join Divine Acquisition and help build Acquisition, Retention & AI Growth Infrastructure for service-based businesses. We\'re hiring Systems Architects, Media Buyers, Sales professionals, and Client Success Managers.',
  keywords: ['careers', 'jobs', 'hiring', 'Divine Acquisition', 'growth infrastructure', 'B2B', 'remote jobs', 'sales jobs', 'marketing jobs'],
  authors: [{ name: 'Divine Acquisition' }],
  creator: 'Divine Acquisition',
  publisher: 'Divine Acquisition',
  metadataBase: new URL('https://hiring.divineacquisition.io'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://hiring.divineacquisition.io',
    siteName: 'Divine Acquisition Careers',
    title: 'Careers at Divine Acquisition | Build Systems That Compound',
    description: 'Join our team of builders, architects, and operators. We build Acquisition, Retention & AI Growth Infrastructure for service-based businesses.',
    images: [
      {
        url: '/logo.png',
        width: 800,
        height: 800,
        alt: 'Divine Acquisition',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Careers at Divine Acquisition',
    description: 'Join our team and help build systems that compound. Remote positions available.',
    creator: '@maliksannie',
    images: ['/logo.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/6.png', sizes: '32x32', type: 'image/png' },
      { url: '/6.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [
      { url: '/6.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/6.png',
  },
  manifest: '/manifest.json',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/6.png" type="image/png" />
        <link rel="apple-touch-icon" href="/6.png" />
        <meta name="theme-color" content="#0a0a0a" />
      </head>
      <body className="bg-[#0a0a0a]">{children}</body>
    </html>
  )
}
