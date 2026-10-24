import type { Metadata } from 'next';
import { RoofingPixel } from '@/app/acq/components/RoofingPixel';
import { AI_FRONT_OFFICE_OFFER } from '@/lib/ghl/tags';
import '../roofing/niche.css';

export const metadata: Metadata = {
  title: { absolute: `${AI_FRONT_OFFICE_OFFER} | Divine Acquisition` },
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

export default function FrontOfficeLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <RoofingPixel contentName={AI_FRONT_OFFICE_OFFER} contentCategory="home-service" pixelCookie="ai-front-office" />
      {children}
    </>
  );
}
