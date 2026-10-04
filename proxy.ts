import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { appHosts, appUrl, isTeamAppPath, sessionRules, type AppKey } from './lib/apps';

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
 *   team.divineacquisition.io       -> /vistrial, VA and SDR pages only (the portal,
 *                                       sign-in, password reset). Any staff path
 *                                       redirects to admin., path preserved.
 *   admin.divineacquisition.io/vistrial -> the staff side of /vistrial (team board,
 *                                       queues, GHL, admin views). The VA portal is
 *                                       reachable there too, for staff View As.
 *   ops. and vistrial. hosts        -> redirect to team. (VA paths) or admin. (staff)
 *   talent.divineacquisition.io     -> /assessment
 *   acq.divineacquisition.io        -> /acq
 *   calls.divineacquisition.io      -> /calls
 *   onboard.divineacquisition.io    -> /onboard
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
// The staff app's permanent home. Login sessions stay private to it: the
// Supabase cookies are host-only (no Domain attribute), so no other subdomain
// can read them.
const TEAM_HOSTS = appHosts('team');
const TEAM_ORIGIN = appUrl('team');
// Staff screens live on the admin portal; the team host is for VAs and SDRs.
const ADMIN_PORTAL_ORIGIN = appUrl('admin');
// Former addresses of the staff app. They redirect to TEAM_ORIGIN or the admin portal.
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
// The admin app: ADMIN_APP_URL (lib/apps), plus any DA_WORKSPACE_HOSTS.
const WORKSPACE_HOSTS = appHosts('admin');
const ACQ_HOSTS = hosts(process.env.VISTRIAL_ACQ_HOSTS, 'acq.divineacquisition.io');
const CALLS_HOSTS = hosts(process.env.VISTRIAL_CALLS_HOSTS, 'calls.divineacquisition.io');
const ONBOARD_HOSTS = hosts(process.env.VISTRIAL_ONBOARD_HOSTS, 'onboard.divineacquisition.io');

const CONTROL_PREFIX = '/ad';
const ADMIN_PREFIX = '/da';
const ACCT_PREFIX = '/acct';
const OPS_PREFIX = '/vistrial';
const HIRING_PREFIX = '/hiring';
const ASSESSMENT_PREFIX = '/assessment';
const ASSESSMENT_ADMIN_PREFIX = '/admin';
const WORKSPACE_PREFIX = '/workspace';
const ACQ_PREFIX = '/acq';
const CALLS_PREFIX = '/calls';
const ONBOARD_PREFIX = '/onboard';

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
  CALLS_PREFIX,
  ONBOARD_PREFIX,
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
  pathname.startsWith('/p/') ||
  pathname.startsWith('/c/') ||
  pathname.startsWith('/s/') ||
  pathname.startsWith('/o/');

const SURFACES: Surface[] = [
  { hosts: CONTROL_HOSTS, prefix: CONTROL_PREFIX },
  { hosts: ADMIN_HOSTS, prefix: ADMIN_PREFIX },
  { hosts: ACCT_HOSTS, prefix: ACCT_PREFIX },
  { hosts: TEAM_HOSTS, prefix: OPS_PREFIX },
  {
    hosts: CAREERS_HOSTS,
    prefix: HIRING_PREFIX,
    allow: (pathname) => pathname === '/' || pathname.startsWith('/hiring'),
  },
  {
    hosts: TALENT_HOSTS,
    prefix: ASSESSMENT_PREFIX,
    // Assessment booking plus public agreement / page / calendar tokens.
    allow: (pathname) =>
      pathname === '/' ||
      pathname.startsWith('/assessment') ||
      pathname.startsWith('/thankyou') ||
      isPublicTokenPath(pathname),
  },
  { hosts: ASSESSMENT_ADMIN_HOSTS, prefix: ASSESSMENT_ADMIN_PREFIX },
  {
    hosts: WORKSPACE_HOSTS,
    prefix: WORKSPACE_PREFIX,
    // Unified admin portal: agreements plus the former Vistrial admin surfaces.
    // Public token routes stay at /p, /c, /s without the workspace prefix.
    // /calls on this host is the 15-minute qualifying workspace (rewritten to
    // /workspace/calls). calls.divineacquisition.io keeps Call Intelligence.
    // /accounts on this host is the audit/debrief/requirements workspace
    // (rewritten to /workspace/accounts). /practices and /hs/companies still
    // open existing records. acq.divineacquisition.io keeps the public
    // practices landing.
    // /hs/calls on this host is the home-services qualifying workspace
    // (rewritten to /workspace/hs/calls).
    // /hs/companies on this host is the home-services audit/debrief/requirements
    // workspace (rewritten to /workspace/hs/companies).
    allow: (pathname) =>
      pathname === '/' ||
      pathname.startsWith('/workspace') ||
      isUnifiedAdminPath(pathname) ||
      isPublicTokenPath(pathname) ||
      pathname.startsWith('/onboard') ||
      pathname === '/login' ||
      pathname.startsWith('/overview') ||
      pathname.startsWith('/recipients') ||
      pathname.startsWith('/agreements') ||
      pathname.startsWith('/templates') ||
      pathname.startsWith('/mapping') ||
      pathname.startsWith('/calendar-links') ||
      pathname.startsWith('/bookings') ||
      pathname === '/calls' ||
      pathname.startsWith('/calls/') ||
      pathname === '/accounts' ||
      pathname.startsWith('/accounts/') ||
      pathname === '/practices' ||
      pathname.startsWith('/practices/') ||
      pathname === '/hs/calls' ||
      pathname.startsWith('/hs/calls/') ||
      pathname === '/hs/companies' ||
      pathname.startsWith('/hs/companies/') ||
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
      pathname === '/thank-you' ||
      pathname.startsWith('/thank-you') ||
      pathname === '/schedule' ||
      pathname.startsWith('/schedule/') ||
      pathname === '/book' ||
      pathname.startsWith('/book') ||
      pathname === '/precall' ||
      pathname.startsWith('/precall') ||
      pathname === '/practices' ||
      pathname.startsWith('/practices') ||
      pathname === '/api/submit-lead' ||
      pathname.startsWith('/acq') ||
      pathname.startsWith('/onboard'),
  },
  {
    hosts: CALLS_HOSTS,
    prefix: CALLS_PREFIX,
    allow: (pathname) => pathname === '/' || pathname.startsWith('/calls'),
  },
  {
    hosts: ONBOARD_HOSTS,
    prefix: ONBOARD_PREFIX,
    allow: (pathname) => pathname === '/' || pathname.startsWith('/onboard'),
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

function isOnboardOnLiveHost(prefix: string | null, pathname: string): boolean {
  return (
    pathname.startsWith(ONBOARD_PREFIX) &&
    (prefix === ACQ_PREFIX || prefix === WORKSPACE_PREFIX)
  );
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

  // Machine doors, cron workers, and the acq lead API are not surfaces.
  // They must not be rewritten into a host surface prefix.
  if (
    pathname.startsWith(MACHINE_DOOR_PREFIX) ||
    pathname.startsWith(CRON_PREFIX) ||
    pathname === '/api/submit-lead'
  ) {
    const response = NextResponse.next();
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    return response;
  }

  const surface = surfaceForHost(host);
  const local = isLocalHost(host);

  // The team app serves its own screens and nothing else: an admin screen asked
  // for there is "not found", so the team app does not even reveal that admin
  // pages exist. Former single-address hosts (ops., vistrial.) redirect with the
  // path kept: team screens to the team app, everything else to the admin app.
  const legacyOpsHost = !local && OPS_HOSTS.includes(host);
  const onTeamHost = !local && TEAM_HOSTS.includes(host);
  const isServicePath = pathname.startsWith('/_next') || pathname.startsWith('/api/');
  if ((legacyOpsHost || onTeamHost) && !isServicePath) {
    const internal = pathname === OPS_PREFIX || pathname.startsWith(`${OPS_PREFIX}/`) ? pathname : `${OPS_PREFIX}${pathname === '/' ? '' : pathname}`;
    if (legacyOpsHost) {
      const target = isTeamAppPath(internal)
        ? `${TEAM_ORIGIN}${internal === OPS_PREFIX ? '/' : internal.slice(OPS_PREFIX.length)}`
        : `${ADMIN_PORTAL_ORIGIN}${internal}`;
      return NextResponse.redirect(`${target}${request.nextUrl.search}`, 308);
    }
    if (!isTeamAppPath(internal)) {
      return new NextResponse('Not found', { status: 404, headers: { 'X-Robots-Tag': 'noindex, nofollow, noarchive' } });
    }
  }

  // The admin app's home is the operations overview.
  if (!local && WORKSPACE_HOSTS.includes(host) && pathname === '/') {
    return NextResponse.redirect(new URL('/vistrial/ops', request.url), 307);
  }

  // Strict host isolation: on a dedicated host, other surfaces are not reachable.
  // The workspace host is the exception — it is the unified admin portal.
  if (
    surface &&
    !local &&
    isForeignSurfacePath(pathname, surface.prefix) &&
    !(surface.prefix === WORKSPACE_PREFIX && isUnifiedAdminPath(pathname)) &&
    !(
      surface.prefix === WORKSPACE_PREFIX &&
      (pathname === '/calls' || pathname.startsWith('/calls/'))
    ) &&
    !isOnboardOnLiveHost(surface.prefix, pathname)
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
    Boolean(prefix === WORKSPACE_PREFIX && isUnifiedAdminPath(pathname)) ||
    isOnboardOnLiveHost(prefix, pathname);

  const isInternal =
    prefix !== null ||
    [
      CONTROL_PREFIX,
      ADMIN_PREFIX,
      ACCT_PREFIX,
      OPS_PREFIX,
      ASSESSMENT_ADMIN_PREFIX,
      WORKSPACE_PREFIX,
      CALLS_PREFIX,
      ONBOARD_PREFIX,
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
    prefix === OPS_PREFIX ||
    prefix === CONTROL_PREFIX ||
    prefix === ACCT_PREFIX ||
    prefix === ASSESSMENT_ADMIN_PREFIX ||
    prefix === WORKSPACE_PREFIX ||
    prefix === CALLS_PREFIX ||
    pathname.startsWith(ADMIN_PREFIX) ||
    pathname.startsWith(CONTROL_PREFIX) ||
    pathname.startsWith(ACCT_PREFIX) ||
    pathname.startsWith(OPS_PREFIX) ||
    pathname.startsWith(ASSESSMENT_ADMIN_PREFIX) ||
    pathname.startsWith(WORKSPACE_PREFIX) ||
    pathname.startsWith(CALLS_PREFIX);

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

    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Per-app session rules: an idle timeout and a maximum session length,
    // stricter on the admin app. Cookies are host-only, like the auth cookies.
    const app: AppKey | null = local ? null : TEAM_HOSTS.includes(host) ? 'team' : WORKSPACE_HOSTS.includes(host) ? 'admin' : null;
    if (!user && app && (request.cookies.has('da_seen') || request.cookies.has('da_started'))) {
      // Signed out: the timers belong to the session that ended.
      response.cookies.set('da_seen', '', { path: '/', maxAge: 0 });
      response.cookies.set('da_started', '', { path: '/', maxAge: 0 });
    }
    if (user && app) {
      const rules = sessionRules(app);
      const now = Math.floor(Date.now() / 1000);
      const seen = Number(request.cookies.get('da_seen')?.value ?? 0);
      const started = Number(request.cookies.get('da_started')?.value ?? 0);
      const expired = (seen && now - seen > rules.idle * 60) || (started && now - started > rules.absolute * 60);
      const cookie = { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/' };
      if (expired) {
        await supabase.auth.signOut({ scope: 'local' });
        response.cookies.set('da_seen', '', { ...cookie, maxAge: 0 });
        response.cookies.set('da_started', '', { ...cookie, maxAge: 0 });
        response.headers.set('x-da-session-expired', '1');
      } else {
        if (!seen || now - seen > 60) response.cookies.set('da_seen', String(now), { ...cookie, maxAge: rules.absolute * 60 });
        if (!started) response.cookies.set('da_started', String(now), { ...cookie, maxAge: rules.absolute * 60 });
      }
    }
  }

  // Acquisition landing is a public ad destination and must remain indexable.
  if ((isInternal && prefix !== ACQ_PREFIX) || pathname.startsWith(ONBOARD_PREFIX)) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|json|ico|webp|jpg)$).*)'],
};
