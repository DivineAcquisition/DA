import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Divine Acquisition | Growth Plan — Done-For-You Retention Engine',
  description: 'We build and run your entire retention engine. Custom reactivation campaigns, AI voicemail drops, multi-channel sequences, and hands-on campaign management. $497/month.',
  openGraph: {
    title: 'Divine Acquisition | Growth Plan — Done-For-You Retention Engine',
    description: 'Custom reactivation campaigns, AI voicemail drops, advanced segmentation, and hands-on management. We build and run your entire retention engine.',
    url: 'https://go.divineacquisition.io/growth',
    images: [
      {
        url: '/logo.png',
        width: 800,
        height: 800,
        alt: 'Divine Acquisition Growth Plan',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Divine Acquisition | Growth Plan',
    description: 'Done-for-you retention engine. Custom campaigns, AI voicemail, and ongoing management. $497/month.',
  },
}

export default function GrowthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
