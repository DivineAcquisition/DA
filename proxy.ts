import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Host-based routing plus Supabase session refresh.
 *
 * Four properties share one deployment:
 *   careers site           -> /hiring  (and / on the careers host)
 *   operator ops hub       -> /vistrial
 *   DA growth surface      -> /da
 *   roles & admin workspace -> /ad
 *
 * On an ops, growth, or control host the root path serves that surface instead
 * of the careers board. Paths stay reachable on any host so previews and local
 * development work.
 */

const hosts = (value: string | undefined, fallback: string) =>
  (value ?? fallback)
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);

const ADMIN_HOSTS = hosts(process.env.VISTRIAL_ADMIN_HOSTS, 'da.vistrial.io');
const CONTROL_HOSTS = hosts(process.env.VISTRIAL_CONTROL_HOSTS, 'ad.vistrial.io');
const OPS_HOSTS = hosts(
  process.env.VISTRIAL_OPS_HOSTS,
  'ops.vistrial.io,ops.divineacquisition.io,vistrial.divineacquisition.io',
);

const ADMIN_PREFIX = '/da';
const CONTROL_PREFIX = '/ad';
const OPS_PREFIX = '/vistrial';

const INTERNAL_PREFIXES = [ADMIN_PREFIX, CONTROL_PREFIX, OPS_PREFIX];

export async function proxy(request: NextRequest) {
  const host = (request.headers.get('host') ?? '').toLowerCase().split(':')[0];
  const { pathname } = request.nextUrl;

  const prefix = CONTROL_HOSTS.includes(host)
    ? CONTROL_PREFIX
    : ADMIN_HOSTS.includes(host)
      ? ADMIN_PREFIX
      : OPS_HOSTS.includes(host)
        ? OPS_PREFIX
        : null;

  // Neither surface is ever indexed, whichever host it was reached on.
  const isInternal =
    prefix !== null || INTERNAL_PREFIXES.some((candidate) => pathname.startsWith(candidate));

  // Layouts cannot read the URL; stamp the pathname so /ad/invite can skip the
  // control-plane gate while every other /ad route stays invite-only staff.
  const requestHeaders = new Headers(request.headers);
  let stampedPath = pathname;
  if (prefix && !pathname.startsWith(prefix)) {
    stampedPath = `${prefix}${pathname === '/' ? '' : pathname}`;
  }
  requestHeaders.set('x-pathname', stampedPath);

  let response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  if (prefix && !pathname.startsWith(prefix)) {
    const url = request.nextUrl.clone();
    url.pathname = stampedPath;
    response = NextResponse.rewrite(url, { request: { headers: requestHeaders } });
  }

  // Refresh the Supabase session so Server Components see a valid token.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const touchesAuth =
    prefix === ADMIN_PREFIX ||
    prefix === CONTROL_PREFIX ||
    pathname.startsWith(ADMIN_PREFIX) ||
    pathname.startsWith(CONTROL_PREFIX) ||
    pathname.startsWith('/acct');

  if (touchesAuth && supabaseUrl && supabaseKey) {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          const refreshed = prefix && !pathname.startsWith(prefix) ? response : NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            refreshed.cookies.set(name, value, options);
          }
          response = refreshed;
        },
      },
    });

    // getUser() rather than getSession(): it validates the token with the auth
    // server instead of trusting whatever is in the cookie.
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
