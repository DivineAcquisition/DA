import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Free SaaS Retention Audit | Divine Acquisition',
  description: 'Get a free 30-minute retention audit for your SaaS. Walk away with 3-5 specific fixes to reduce churn and keep more customers. Limited spots available.',
  openGraph: {
    title: 'Find Out Exactly Why Your Users Are Churning',
    description: 'Free 30-minute SaaS retention audit. No pitch, no obligation — just actionable feedback to stop the churn.',
    url: 'https://go.divineacquisition.io/free-audit',
    images: [
      {
        url: '/logo.png',
        width: 800,
        height: 800,
        alt: 'Divine Acquisition - Free SaaS Retention Audit',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Find Out Exactly Why Your Users Are Churning',
    description: 'Free 30-minute SaaS retention audit. No pitch, no obligation — just actionable feedback to stop the churn.',
  },
}

export default function FreeAuditLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
