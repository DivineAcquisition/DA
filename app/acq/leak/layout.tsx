import { LeakPixel } from '@/app/acq/components/revenue-leak/LeakPixel';

export default function RevenueLeakLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LeakPixel />
      {children}
    </>
  );
}
