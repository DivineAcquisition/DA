import { Plus_Jakarta_Sans } from 'next/font/google';

/** Workspace headlines. Body text stays on the root Inter. */
export const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
});
