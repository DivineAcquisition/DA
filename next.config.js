const PRIVATE_LINK_HEADERS = [
  { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'Cache-Control', value: 'private, no-store' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '25mb',
    },
  },
  async rewrites() {
    return [
      { source: '/roofing', destination: '/acq/roofing' },
      { source: '/roofing/:path*', destination: '/acq/roofing/:path*' },
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
    ];
  },
};

module.exports = nextConfig
