import localFont from 'next/font/local';

/**
 * Inter Display, the same face as the Vistrial landing page and app
 * (Vistrial src/lib/fonts.ts): Inter's own variable files with the opsz axis
 * locked to 32 in the @font-face, so every size is the Display cut. Used by
 * the company site, the admin workspace, and the end-of-day page.
 */
export const interDisplay = localFont({
  src: [
    { path: './InterVariable.woff2', weight: '100 900', style: 'normal' },
    { path: './InterVariable-Italic.woff2', weight: '100 900', style: 'italic' },
  ],
  variable: '--font-inter-display',
  display: 'swap',
  // Single quotes: next/font serializes this into a query string.
  declarations: [{ prop: 'font-variation-settings', value: "'opsz' 32" }],
});
