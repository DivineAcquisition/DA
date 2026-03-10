import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Divine Acquisition | Fractional Growth Operations for Service Businesses',
  description: 'We audit your entire operation, identify every revenue leak, and build AI-powered systems that turn your service business into a compounding growth machine — in 14 days or less.',
  openGraph: {
    title: 'Divine Acquisition | Growth Infrastructure That Scales',
    description: 'Stop losing revenue to broken operations. We build AI-powered systems, data architecture, and retention engines for service businesses doing $10K-$250K/month.',
    url: 'https://divineacquisition.io',
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
  },
}

export default function HiringLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
