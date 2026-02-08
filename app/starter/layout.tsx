import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Divine Acquisition | Stop Losing Customers — Starter Plan',
  description: 'Pre-built sales & retention workflows plus a custom booking page that turns your past customers into recurring revenue. Built for residential cleaning companies. $197/month.',
  openGraph: {
    title: 'Divine Acquisition | Starter Plan — Reactivate Past Customers',
    description: 'Pre-built reactivation workflows, retention sequences, custom booking page, and campaign dashboard. Plug in and go live today for $197/month.',
    url: 'https://go.divineacquisition.io/lt-offer',
    images: [
      {
        url: '/logo.png',
        width: 800,
        height: 800,
        alt: 'Divine Acquisition Starter Plan',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Divine Acquisition | Starter Plan',
    description: 'Stop chasing new leads. Reactivate the customers you already have. $197/month.',
  },
}

export default function StarterLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
