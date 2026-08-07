import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Strict host-based routing plus Supabase session refresh.
 *
 * Each Divine Acquisition property is a dedicated host. On that host only its
 * surface is reachable — every other app path returns 404. Previews and
 * localhost keep path-based access so development still works without DNS.
 *
 *   admin.divineacquisition.io      -> unified admin portal
 *                                       /workspace (agreements)
 *                                       /da (growth)
 *                                       /ad (control)
 *                                       /admin (assessment)
 *                                       /vistrial (ops)
 *   da.divineacquisition.io         -> /da   (legacy alias during cutover)
 *   ad.divineacquisition.io         -> /ad
 *   acct.divineacquisition.io       -> /acct
 *   ops.divineacquisition.io        -> /vistrial
 *   talent.divineacquisition.io     -> /assessment
 *   acq.divineacquisition.io        -> /acq
 *   careers / apex                  -> /hiring (and /)
 */

const hosts = (value: string | undefined, fallback: string) =>
  (value ?? fallback)
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);

const CONTROL_HOSTS = hosts(process.env.VISTRIAL_CONTROL_HOSTS, 'ad.divineacquisition.io');
const ADMIN_HOSTS = hosts(process.env.VISTRIAL_ADMIN_HOSTS, 'da.divineacquisition.io');
const ACCT_HOSTS = hosts(process.env.VISTRIAL_ACCT_HOSTS, 'acct.divineacquisition.io');
const OPS_HOSTS = hosts(
  process.env.VISTRIAL_OPS_HOSTS,
  'ops.divineacquisition.io,vistrial.divineacquisition.io',
);
const CAREERS_HOSTS = hosts(
  process.env.VISTRIAL_CAREERS_HOSTS,
  'divineacquisition.io,www.divineacquisition.io',
);
const TALENT_HOSTS = hosts(process.env.VISTRIAL_TALENT_HOSTS, 'talent.divineacquisition.io');
const ASSESSMENT_ADMIN_HOSTS = hosts(process.env.VISTRIAL_ASSESSMENT_ADMIN_HOSTS, '');
const WORKSPACE_HOSTS = hosts(
  process.env.DA_WORKSPACE_HOSTS,
  'admin.divineacquisition.io',
);
const ACQ_HOSTS = hosts(process.env.VISTRIAL_ACQ_HOSTS, 'acq.divineacquisition.io');

const CONTROL_PREFIX = '/ad';
const ADMIN_PREFIX = '/da';
const ACCT_PREFIX = '/acct';
const OPS_PREFIX = '/vistrial';
const HIRING_PREFIX = '/hiring';
const ASSESSMENT_PREFIX = '/assessment';
const ASSESSMENT_ADMIN_PREFIX = '/admin';
const WORKSPACE_PREFIX = '/workspace';
const ACQ_PREFIX = '/acq';

const SURFACE_PREFIXES = [
  CONTROL_PREFIX,
  ADMIN_PREFIX,
  ACCT_PREFIX,
  OPS_PREFIX,
  HIRING_PREFIX,
  ASSESSMENT_PREFIX,
  ASSESSMENT_ADMIN_PREFIX,
  WORKSPACE_PREFIX,
  ACQ_PREFIX,
];

/** Surfaces co-hosted on admin.divineacquisition.io under one sidebar. */
function isUnifiedAdminPath(pathname: string): boolean {
  return (
    pathname === CONTROL_PREFIX ||
    pathname.startsWith(`${CONTROL_PREFIX}/`) ||
    pathname === ADMIN_PREFIX ||
    pathname.startsWith(`${ADMIN_PREFIX}/`) ||
    pathname === ASSESSMENT_ADMIN_PREFIX ||
    pathname.startsWith(`${ASSESSMENT_ADMIN_PREFIX}/`) ||
    pathname === OPS_PREFIX ||
    pathname.startsWith(`${OPS_PREFIX}/`)
  );
}

type Surface = {
  hosts: string[];
  prefix: string;
  /** Paths on this host that are allowed besides the surface prefix (e.g. invite). */
  allow?: (pathname: string) => boolean;
};

const isPublicTokenPath = (pathname: string) =>
  pathname.startsWith('/p/') || pathname.startsWith('/c/');

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
  { hosts: TALENT_HOSTS, prefix: ASSESSMENT_PREFIX },
  { hosts: ASSESSMENT_ADMIN_HOSTS, prefix: ASSESSMENT_ADMIN_PREFIX },
  {
    hosts: WORKSPACE_HOSTS,
    prefix: WORKSPACE_PREFIX,
    // Unified admin portal: agreements plus the former Vistrial admin surfaces.
    // Public token routes stay at /p and /c without the workspace prefix.
    allow: (pathname) =>
      pathname === '/' ||
      pathname.startsWith('/workspace') ||
      isUnifiedAdminPath(pathname) ||
      isPublicTokenPath(pathname) ||
      pathname === '/login' ||
      pathname.startsWith('/overview') ||
      pathname.startsWith('/recipients') ||
      pathname.startsWith('/agreements') ||
      pathname.startsWith('/templates') ||
      pathname.startsWith('/mapping') ||
      pathname.startsWith('/calendar-links') ||
      pathname.startsWith('/settings'),
  },
  {
    hosts: ACQ_HOSTS,
    prefix: ACQ_PREFIX,
    // Bare legal paths rewrite into /acq/*; keep the surface locked otherwise.
    allow: (pathname) =>
      pathname === '/' ||
      pathname === '/terms' ||
      pathname === '/disclaimer' ||
      pathname === '/privacy' ||
      pathname.startsWith('/acq'),
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
const CRON_PREFIX = '/api/cron/';

export async function proxy(request: NextRequest) {
  const host = (request.headers.get('host') ?? '').toLowerCase().split(':')[0];
  const { pathname } = request.nextUrl;

  // Machine doors and cron workers are not surfaces. They authenticate with their
  // own secrets and must not be rewritten into a host surface prefix.
  if (pathname.startsWith(MACHINE_DOOR_PREFIX) || pathname.startsWith(CRON_PREFIX)) {
    const response = NextResponse.next();
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    return response;
  }

  const surface = surfaceForHost(host);
  const local = isLocalHost(host);

  // Strict host isolation: on a dedicated host, other surfaces are not reachable.
  // The workspace host is the exception — it is the unified admin portal.
  if (
    surface &&
    !local &&
    isForeignSurfacePath(pathname, surface.prefix) &&
    !(surface.prefix === WORKSPACE_PREFIX && isUnifiedAdminPath(pathname))
  ) {
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
    // Public marketing hosts: anything outside the surface is 404.
    if (
      surface.prefix === HIRING_PREFIX ||
      surface.prefix === ACQ_PREFIX ||
      surface.prefix === WORKSPACE_PREFIX
    ) {
      return new NextResponse('Not found', {
        status: 404,
        headers: { 'X-Robots-Tag': 'noindex, nofollow, noarchive' },
      });
    }
  }

  const prefix = surface?.prefix ?? null;
  const skipRewrite =
    Boolean(prefix && isPublicTokenPath(pathname)) ||
    Boolean(prefix === WORKSPACE_PREFIX && isUnifiedAdminPath(pathname));

  const isInternal =
    prefix !== null ||
    [
      CONTROL_PREFIX,
      ADMIN_PREFIX,
      ACCT_PREFIX,
      OPS_PREFIX,
      ASSESSMENT_ADMIN_PREFIX,
      WORKSPACE_PREFIX,
    ].some((candidate) => pathname.startsWith(candidate)) ||
    isPublicTokenPath(pathname);

  const requestHeaders = new Headers(request.headers);
  let stampedPath = pathname;
  if (prefix && prefix !== HIRING_PREFIX && !pathname.startsWith(prefix) && !skipRewrite) {
    stampedPath = `${prefix}${pathname === '/' ? '' : pathname}`;
  }
  requestHeaders.set('x-pathname', stampedPath);
  requestHeaders.set('x-vistrial-host', host);
  if (prefix) requestHeaders.set('x-vistrial-surface', prefix);
  if (prefix === WORKSPACE_PREFIX || (local && isUnifiedAdminPath(pathname))) {
    requestHeaders.set('x-da-unified-admin', '1');
  }

  let response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Dedicated hosts rewrite bare paths into their surface. Careers keeps `/`
  // as the board and `/hiring/*` as role pages — no rewrite needed for `/`.
  // Public token routes (/p, /c) stay unprefixed on the workspace host.
  if (prefix && prefix !== HIRING_PREFIX && !pathname.startsWith(prefix) && !skipRewrite) {
    const url = request.nextUrl.clone();
    url.pathname = stampedPath;
    response = NextResponse.rewrite(url, { request: { headers: requestHeaders } });
  }

  // From the environment only. A fallback here would have an unconfigured deploy
  // refreshing sessions against the live project without anybody noticing.
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.SUPABASE_ANON_KEY?.trim();

  const touchesAuth =
    prefix === ADMIN_PREFIX ||
    prefix === CONTROL_PREFIX ||
    prefix === ACCT_PREFIX ||
    prefix === ASSESSMENT_ADMIN_PREFIX ||
    prefix === WORKSPACE_PREFIX ||
    pathname.startsWith(ADMIN_PREFIX) ||
    pathname.startsWith(CONTROL_PREFIX) ||
    pathname.startsWith(ACCT_PREFIX) ||
    pathname.startsWith(OPS_PREFIX) ||
    pathname.startsWith(ASSESSMENT_ADMIN_PREFIX) ||
    pathname.startsWith(WORKSPACE_PREFIX);

  if (touchesAuth && supabaseUrl && supabaseKey) {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          const refreshed =
            prefix && prefix !== HIRING_PREFIX && !pathname.startsWith(prefix) && !skipRewrite
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

  // Acquisition landing is a public ad destination and must remain indexable.
  if (isInternal && prefix !== ACQ_PREFIX) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|json|ico|webp|jpg)$).*)'],
};
