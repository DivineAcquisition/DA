import { Plus_Jakarta_Sans } from 'next/font/google';
import '../workspace/workspace.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta',
  display: 'swap',
});

export default function PublicCalendarLayout({ children }: { children: React.ReactNode }) {
  return <div className={`da-workspace ${plusJakarta.variable}`}>{children}</div>;
}
