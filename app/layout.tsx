import type { Metadata, Viewport } from 'next'
import { Inter, Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

// Headings in the DA document house style. Body copy stays on Inter.
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Careers at Divine Acquisition | Join Our Team',
    template: '%s | Divine Acquisition Careers',
  },
  description: 'Join Divine Acquisition and help build Acquisition, Retention & AI Growth Infrastructure for service-based businesses. We\'re hiring SDRs, Systems Architects, Media Buyers, Closers, and Client Success Managers.',
  keywords: ['careers', 'jobs', 'hiring', 'Divine Acquisition', 'SDR placement', 'growth infrastructure', 'B2B', 'remote jobs', 'sales jobs', 'marketing jobs'],
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
        url: '/icon-512.png',
        width: 512,
        height: 512,
        alt: 'Divine Acquisition',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Careers at Divine Acquisition',
    description: 'Join our team and help build systems that compound. Remote positions available.',
    creator: '@maliksannie',
    images: ['/icon-512.png'],
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
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    shortcut: '/favicon-32x32.png',
  },
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  themeColor: '#07070b',
  colorScheme: 'dark',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jakarta.variable}`}>
      <head>
        <link rel="preconnect" href="https://fast.wistia.com" />
      </head>
      <body className="bg-ink-950 font-sans">{children}</body>
    </html>
  )
}
