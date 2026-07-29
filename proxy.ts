import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Strict host-based routing plus Supabase session refresh.
 *
 * Each Vistrial property is a dedicated host. On that host only its surface is
 * reachable — every other app path returns 404. Previews and localhost keep
 * path-based access so development still works without DNS.
 *
 *   ad.vistrial.io   -> /ad
 *   da.vistrial.io   -> /da
 *   acct.vistrial.io -> /acct
 *   ops.vistrial.io  -> /vistrial
 *   careers / other  -> /hiring (and /)
 */

const hosts = (value: string | undefined, fallback: string) =>
  (value ?? fallback)
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);

const CONTROL_HOSTS = hosts(process.env.VISTRIAL_CONTROL_HOSTS, 'ad.vistrial.io');
const ADMIN_HOSTS = hosts(process.env.VISTRIAL_ADMIN_HOSTS, 'da.vistrial.io');
const ACCT_HOSTS = hosts(process.env.VISTRIAL_ACCT_HOSTS, 'acct.vistrial.io');
const OPS_HOSTS = hosts(
  process.env.VISTRIAL_OPS_HOSTS,
  'ops.vistrial.io,ops.divineacquisition.io,vistrial.divineacquisition.io',
);
const CAREERS_HOSTS = hosts(
  process.env.VISTRIAL_CAREERS_HOSTS,
  'vistrial.io,www.vistrial.io,divineacquisition.io,www.divineacquisition.io',
);

const CONTROL_PREFIX = '/ad';
const ADMIN_PREFIX = '/da';
const ACCT_PREFIX = '/acct';
const OPS_PREFIX = '/vistrial';
const HIRING_PREFIX = '/hiring';

const SURFACE_PREFIXES = [CONTROL_PREFIX, ADMIN_PREFIX, ACCT_PREFIX, OPS_PREFIX, HIRING_PREFIX];

type Surface = {
  hosts: string[];
  prefix: string;
  /** Paths on this host that are allowed besides the surface prefix (e.g. invite). */
  allow?: (pathname: string) => boolean;
};

const SURFACES: Surface[] = [
  { hosts: CONTROL_HOSTS, prefix: CONTROL_PREFIX },
  { hosts: ADMIN_HOSTS, prefix: ADMIN_PREFIX },
  { hosts: ACCT_HOSTS, prefix: ACCT_PREFIX },
  { hosts: OPS_HOSTS, prefix: OPS_PREFIX },
  {
    hosts: CAREERS_HOSTS,
    prefix: HIRING_PREFIX,
    allow: (pathname) => pathname === '/' || pathname.startsWith('/hiring'),
  },
];

const isLocalHost = (host: string) =>
  host === 'localhost' ||
  host === '127.0.0.1' ||
  host.endsWith('.localhost') ||
  host.endsWith('.vercel.app');

function surfaceForHost(host: string): Surface | null {
  return SURFACES.find((surface) => surface.hosts.includes(host)) ?? null;
}

function isForeignSurfacePath(pathname: string, ownPrefix: string): boolean {
  return SURFACE_PREFIXES.some(
    (prefix) => prefix !== ownPrefix && (pathname === prefix || pathname.startsWith(`${prefix}/`)),
  );
}

const MACHINE_DOOR_PREFIX = '/api/webhooks/';

export async function proxy(request: NextRequest) {
  const host = (request.headers.get('host') ?? '').toLowerCase().split(':')[0];
  const { pathname } = request.nextUrl;

  // A machine door is not a surface. A provider is configured with one URL and
  // authenticates with that door's own secret, so it must not be rewritten into a
  // surface prefix and must not depend on which host DNS happens to point at. It
  // also carries no session, so there is nothing here to refresh.
  if (pathname.startsWith(MACHINE_DOOR_PREFIX)) {
    const response = NextResponse.next();
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    return response;
  }

  const surface = surfaceForHost(host);
  const local = isLocalHost(host);

  // Strict host isolation: on a dedicated host, other surfaces are not reachable.
  if (surface && !local && isForeignSurfacePath(pathname, surface.prefix)) {
    return new NextResponse('Not found', {
      status: 404,
      headers: { 'X-Robots-Tag': 'noindex, nofollow, noarchive' },
    });
  }

  if (
    surface &&
    !local &&
    surface.allow &&
    !surface.allow(pathname) &&
    !pathname.startsWith(surface.prefix) &&
    pathname !== '/'
  ) {
    // Careers host: everything that is not hiring is 404.
    if (surface.prefix === HIRING_PREFIX) {
      return new NextResponse('Not found', {
        status: 404,
        headers: { 'X-Robots-Tag': 'noindex, nofollow, noarchive' },
      });
    }
  }

  const prefix = surface?.prefix ?? null;

  const isInternal =
    prefix !== null ||
    [CONTROL_PREFIX, ADMIN_PREFIX, ACCT_PREFIX, OPS_PREFIX].some((candidate) =>
      pathname.startsWith(candidate),
    );

  const requestHeaders = new Headers(request.headers);
  let stampedPath = pathname;
  if (prefix && prefix !== HIRING_PREFIX && !pathname.startsWith(prefix)) {
    stampedPath = `${prefix}${pathname === '/' ? '' : pathname}`;
  }
  requestHeaders.set('x-pathname', stampedPath);
  requestHeaders.set('x-vistrial-host', host);
  if (prefix) requestHeaders.set('x-vistrial-surface', prefix);

  let response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Dedicated hosts rewrite bare paths into their surface. Careers keeps `/`
  // as the board and `/hiring/*` as role pages — no rewrite needed for `/`.
  if (prefix && prefix !== HIRING_PREFIX && !pathname.startsWith(prefix)) {
    const url = request.nextUrl.clone();
    url.pathname = stampedPath;
    response = NextResponse.rewrite(url, { request: { headers: requestHeaders } });
  }

  // From the environment only. A fallback here would have an unconfigured deploy
  // refreshing sessions against the live project without anybody noticing.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  const touchesAuth =
    prefix === ADMIN_PREFIX ||
    prefix === CONTROL_PREFIX ||
    prefix === ACCT_PREFIX ||
    pathname.startsWith(ADMIN_PREFIX) ||
    pathname.startsWith(CONTROL_PREFIX) ||
    pathname.startsWith(ACCT_PREFIX) ||
    pathname.startsWith(OPS_PREFIX);

  if (touchesAuth && supabaseUrl && supabaseKey) {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          const refreshed =
            prefix && prefix !== HIRING_PREFIX && !pathname.startsWith(prefix)
              ? response
              : NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            refreshed.cookies.set(name, value, options);
          }
          response = refreshed;
        },
      },
    });

    await supabase.auth.getUser();
  }

  if (isInternal) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|json|ico|webp|jpg)$).*)'],
};
