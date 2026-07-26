import { NextResponse, type NextRequest } from 'next/server';

/**
 * Host-based routing. Both properties live in one deployment: the careers site
 * and the internal ops hub. The hub gets its own domain, and on that domain the
 * root path serves the hub rather than the careers board.
 *
 * Set VISTRIAL_HOSTS to a comma-separated list of hostnames for the hub, for
 * example "ops.divineacquisition.io,vistrial.divineacquisition.io". Paths under
 * /vistrial stay reachable on any host so previews and local development work.
 */
const VISTRIAL_HOSTS = (process.env.VISTRIAL_HOSTS ?? 'ops.divineacquisition.io,vistrial.divineacquisition.io')
  .split(',')
  .map((host) => host.trim().toLowerCase())
  .filter(Boolean);

const HUB_PREFIX = '/vistrial';

export function middleware(request: NextRequest) {
  const host = (request.headers.get('host') ?? '').toLowerCase().split(':')[0];
  const isHubHost = VISTRIAL_HOSTS.includes(host);
  const { pathname } = request.nextUrl;

  // The hub is internal, so it is never indexed however it was reached.
  const noindex = (response: NextResponse) => {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    return response;
  };

  if (isHubHost && !pathname.startsWith(HUB_PREFIX)) {
    const url = request.nextUrl.clone();
    url.pathname = `${HUB_PREFIX}${pathname === '/' ? '' : pathname}`;
    return noindex(NextResponse.rewrite(url));
  }

  if (pathname.startsWith(HUB_PREFIX)) return noindex(NextResponse.next());

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|json|ico|webp|jpg)$).*)'],
};
