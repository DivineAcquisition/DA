import type { Metadata } from 'next'
import './hiring.css'

export const metadata: Metadata = {
  title: 'Open Positions | Divine Acquisition Careers',
  description: 'Explore career opportunities at Divine Acquisition. We\'re hiring for our SDR Placement Role, Systems Architects, Media Buyers, SDR / Setters, Closers, and Client Success Managers. Remote positions with competitive compensation.',
  alternates: {
    canonical: 'https://hiring.divineacquisition.io/',
  },
  openGraph: {
    title: 'Open Positions at Divine Acquisition',
    description: 'Join our team of builders and operators. Build systems that compound trust, revenue, and retention for service-based businesses.',
    url: 'https://hiring.divineacquisition.io/',
    images: [
      {
        url: '/icon-512.png',
        width: 512,
        height: 512,
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
