import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Book Your Strategy Call | Divine Acquisition',
  description: 'Schedule a strategy call to discuss how the Backend Conversion System can help you recover lost revenue and scale your home service business.',
  openGraph: {
    title: 'Book Your Strategy Call | Divine Acquisition',
    description: 'Schedule a time to discuss how we can help you recover lost revenue and scale your home service business.',
    url: 'https://hiring.divineacquisition.io/booking-bcs',
    images: [
      {
        url: '/logo.png',
        width: 800,
        height: 800,
        alt: 'Divine Acquisition - Book Strategy Call',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Book Your Strategy Call | Divine Acquisition',
    description: 'Schedule a time to discuss how we can help you recover lost revenue.',
  },
}

export default function BookingBCSLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
