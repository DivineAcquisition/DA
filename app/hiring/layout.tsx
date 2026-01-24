import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Open Positions | Divine Acquisition Careers',
  description: 'Explore career opportunities at Divine Acquisition. We\'re hiring Systems Architects, Media Buyers, Appointment Setters, Closers, and Client Success Managers. Remote positions with competitive compensation.',
  openGraph: {
    title: 'Open Positions at Divine Acquisition',
    description: 'Join our team of builders and operators. Build systems that compound trust, revenue, and retention for service-based businesses.',
    url: 'https://hiring.divineacquisition.io/hiring',
    images: [
      {
        url: '/logo.png',
        width: 800,
        height: 800,
        alt: 'Divine Acquisition Careers',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Open Positions at Divine Acquisition',
    description: 'Join our team of builders and operators. Remote positions available.',
  },
}

export default function HiringLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
