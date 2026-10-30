const PRIVATE_LINK_HEADERS = [
  { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'Cache-Control', value: 'private, no-store' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },
  outputFileTracingIncludes: {
    '/s/pdf-worker': ['./node_modules/pdfjs-dist/build/pdf.worker.min.mjs'],
  },
  async rewrites() {
    return [
      { source: '/roofing', destination: '/acq/roofing' },
      { source: '/roofing/:path*', destination: '/acq/roofing/:path*' },
      { source: '/cleaning', destination: '/go/cleaning' },
      { source: '/cleaning/:path*', destination: '/go/cleaning/:path*' },
      { source: '/thanks', destination: '/go/thanks' },
    ];
  },
  async headers() {
    const noindex = { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' };
    return [
      { source: '/roofing', headers: [noindex] },
      { source: '/roofing/:path*', headers: [noindex] },
      { source: '/acq/roofing', headers: [noindex] },
      { source: '/acq/roofing/:path*', headers: [noindex] },
      {
        // Tokenized agreement links are credentials: never indexed, never
        // handed to another site in a Referer header, never cached shared.
        source: '/s/:path*',
        headers: PRIVATE_LINK_HEADERS,
      },
      {
        // Onboarding links: same rules.
        source: '/o/:path*',
        headers: PRIVATE_LINK_HEADERS,
      },
      {
        // Client report links: one report, no index, no shared cache.
        source: '/r/:path*',
        headers: PRIVATE_LINK_HEADERS,
      },
    ];
  },
};

module.exports = nextConfig
