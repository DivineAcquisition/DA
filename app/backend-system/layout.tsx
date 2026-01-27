import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Backend Conversion System | Divine Acquisition',
  description: 'The Backend Conversion System helps home service companies recover lost revenue through AI-powered lead capture, automated follow-up, and systematic conversion optimization.',
  openGraph: {
    title: 'Backend Conversion System | Divine Acquisition',
    description: 'Recover lost revenue with AI-powered lead capture and automated follow-up systems.',
    url: 'https://hs.divineacquisition.io/backend-system',
    images: [
      {
        url: '/logo.png',
        width: 800,
        height: 800,
        alt: 'Divine Acquisition - Backend Conversion System',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Backend Conversion System | Divine Acquisition',
    description: 'Recover lost revenue with AI-powered lead capture and automated follow-up systems.',
  },
}

export default function BackendSystemLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
