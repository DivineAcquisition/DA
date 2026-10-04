import { Inter } from 'next/font/google';

/** Inter with its optical-size axis: opsz 32 is the Inter Display cut. */
export const interDisplay = Inter({
  subsets: ['latin'],
  axes: ['opsz'],
  variable: '--font-inter-display',
  display: 'swap',
});
