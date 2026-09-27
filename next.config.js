/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // Tokenized agreement links are credentials: never indexed, never
        // handed to another site in a Referer header, never cached shared.
        source: '/s/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Cache-Control', value: 'private, no-store' },
        ],
      },
    ];
  },
};

module.exports = nextConfig
