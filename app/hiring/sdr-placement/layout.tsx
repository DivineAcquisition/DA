import type { Metadata } from 'next';
import { getRole } from '../../data/roles';

const role = getRole('sdr-placement');

export const metadata: Metadata = {
  title: "SDR Placement Role - We're Hiring Operators, Not Virtual Assistants",
  description: role?.seoDescription,
  alternates: {
    canonical: 'https://hiring.divineacquisition.io/hiring/sdr-placement',
  },
  openGraph: {
    title: "We're Hiring Operators. Not Virtual Assistants.",
    description: role?.seoDescription,
    url: 'https://hiring.divineacquisition.io/hiring/sdr-placement',
    type: 'website',
    images: [
      {
        url: '/icon-512.png',
        width: 512,
        height: 512,
        alt: 'DivineAcquisition SDR Placement Role',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: "We're Hiring Operators. Not Virtual Assistants.",
    description: role?.seoDescription,
  },
};

export default function SdrPlacementLayout({ children }: { children: React.ReactNode }) {
  return children;
}
