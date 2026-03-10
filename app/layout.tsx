import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Divine Acquisition | Fractional Growth Operations',
    template: '%s | Divine Acquisition',
  },
  description: 'We audit your entire operation, identify every revenue leak, and build AI-powered systems that turn your service business into a compounding growth machine — in 14 days or less.',
  keywords: ['growth operations', 'Divine Acquisition', 'AI automation', 'service business', 'fractional COO', 'growth infrastructure', 'retention systems', 'lead automation'],
  authors: [{ name: 'Divine Acquisition' }],
  creator: 'Divine Acquisition',
  publisher: 'Divine Acquisition',
  metadataBase: new URL('https://divineacquisition.io'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://divineacquisition.io',
    siteName: 'Divine Acquisition',
    title: 'Divine Acquisition | Growth Infrastructure That Scales',
    description: 'Stop losing revenue to broken operations. We build AI-powered systems, data architecture, and retention engines for service businesses.',
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
    title: 'Divine Acquisition | Growth Infrastructure That Scales',
    description: 'Fractional Growth Operations for service businesses. From audit to infrastructure in 14 days.',
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
      { url: '/6 (0-00-00-00)_1.png', sizes: '32x32', type: 'image/png' },
      { url: '/6 (0-00-00-00)_1.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [
      { url: '/6 (0-00-00-00)_1.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/6 (0-00-00-00)_1.png',
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
        <link rel="icon" href="/6 (0-00-00-00)_1.png" type="image/png" />
        <link rel="apple-touch-icon" href="/6 (0-00-00-00)_1.png" />
        <meta name="theme-color" content="#0a0a0a" />
      </head>
      <body className="bg-[#0a0a0a]">{children}</body>
    </html>
  )
}
