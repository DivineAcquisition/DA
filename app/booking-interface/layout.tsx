import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Custom Booking Interface for Cleaning Companies | Divine Acquisition',
  description: 'Get a custom booking interface that converts website visitors into paying customers. Automated reminders, deposit collection, calendar sync, and more. Built specifically for cleaning companies.',
  keywords: ['booking system', 'cleaning company software', 'online booking', 'appointment scheduling', 'cleaning business', 'booking interface', 'automated scheduling'],
  openGraph: {
    title: 'Custom Booking Interface for Cleaning Companies',
    description: 'Stop losing bookings to your competition. Get a custom booking interface that converts website visitors into paying customers — automatically.',
    url: 'https://divineacquisition.io/booking-interface',
    type: 'website',
    images: [
      {
        url: '/logo.png',
        width: 800,
        height: 800,
        alt: 'Divine Acquisition - Booking Interface for Cleaning Companies',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Custom Booking Interface for Cleaning Companies',
    description: 'Stop losing bookings to your competition. Get a custom booking interface that converts website visitors into paying customers — automatically.',
  },
}

export default function BookingInterfaceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
