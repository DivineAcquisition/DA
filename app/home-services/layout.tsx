import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Home Service Lead Generation | Divine Acquisition',
  description: 'Stop losing jobs to competitors who call back first. We generate leads and respond in under 60 seconds with AI-powered instant response, so you close more jobs without hiring more staff.',
  openGraph: {
    title: 'Stop Losing Jobs to the Contractor Who Called Back First',
    description: 'We get you leads and call them in under 60 seconds — so you close more jobs without hiring more staff. AI-powered lead generation for home service contractors.',
    url: 'https://divineacquisition.io/home-services',
    images: [
      {
        url: '/logo.png',
        width: 800,
        height: 800,
        alt: 'Divine Acquisition - Home Service Lead Generation',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Stop Losing Jobs to the Contractor Who Called Back First',
    description: 'AI-powered lead generation for home service contractors. Respond in under 60 seconds.',
  },
}

export default function HomeServicesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
