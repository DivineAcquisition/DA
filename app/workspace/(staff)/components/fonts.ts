import localFont from 'next/font/local';

/**
 * Inter Display, the Vistrial face. The files in public/fonts are the display
 * cut. Regular covers 400–600 so medium titles stay on that cut; bold is 700.
 */
export const interDisplay = localFont({
  src: [
    { path: '../../../../public/fonts/InterDisplay-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../../../../public/fonts/InterDisplay-Regular.woff2', weight: '500', style: 'normal' },
    { path: '../../../../public/fonts/InterDisplay-Regular.woff2', weight: '600', style: 'normal' },
    { path: '../../../../public/fonts/InterDisplay-Bold.woff2', weight: '700', style: 'normal' },
    { path: '../../../../public/fonts/InterDisplay-Italic.woff2', weight: '400', style: 'italic' },
    { path: '../../../../public/fonts/InterDisplay-Italic.woff2', weight: '500', style: 'italic' },
  ],
  variable: '--font-inter-display',
  display: 'swap',
  fallback: ['ui-sans-serif', 'system-ui', 'sans-serif'],
});
