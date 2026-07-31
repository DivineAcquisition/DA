import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    default: 'Book your assessment | Divine Acquisition',
    template: '%s | Divine Acquisition Talent',
  },
  description: 'Schedule a 20–30 minute assessment call with Divine Acquisition Talent.',
  robots: { index: false, follow: false, nocache: true },
};

export default function AssessmentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
