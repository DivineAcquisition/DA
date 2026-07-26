import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Host-based routing plus Supabase session refresh.
 *
 * Three properties share one deployment:
 *   careers site      -> /hiring  (and / on the careers host)
 *   operator ops hub  -> /vistrial
 *   DA admin surface  -> /da      (client documentation and growth tracking)
 *
 * On an ops or admin host the root path serves that surface instead of the
 * careers board. Paths stay reachable on any host so previews and local
 * development work.
 */

const hosts = (value: string | undefined, fallback: string) =>
  (value ?? fallback)
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);

const ADMIN_HOSTS = hosts(process.env.VISTRIAL_ADMIN_HOSTS, 'da.vistrial.io');
const OPS_HOSTS = hosts(
  process.env.VISTRIAL_OPS_HOSTS,
  'ops.vistrial.io,ops.divineacquisition.io,vistrial.divineacquisition.io',
);

const ADMIN_PREFIX = '/da';
const OPS_PREFIX = '/vistrial';

const INTERNAL_PREFIXES = [ADMIN_PREFIX, OPS_PREFIX];

export async function proxy(request: NextRequest) {
  const host = (request.headers.get('host') ?? '').toLowerCase().split(':')[0];
  const { pathname } = request.nextUrl;

  const prefix = ADMIN_HOSTS.includes(host)
    ? ADMIN_PREFIX
    : OPS_HOSTS.includes(host)
      ? OPS_PREFIX
      : null;

  // Neither surface is ever indexed, whichever host it was reached on.
  const isInternal =
    prefix !== null || INTERNAL_PREFIXES.some((candidate) => pathname.startsWith(candidate));

  let response = NextResponse.next({ request });

  if (prefix && !pathname.startsWith(prefix)) {
    const url = request.nextUrl.clone();
    url.pathname = `${prefix}${pathname === '/' ? '' : pathname}`;
    response = NextResponse.rewrite(url);
  }

  // Refresh the Supabase session so Server Components see a valid token. Only
  // the admin surface is authenticated, so this is skipped elsewhere.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const touchesAdmin = prefix === ADMIN_PREFIX || pathname.startsWith(ADMIN_PREFIX);

  if (touchesAdmin && supabaseUrl && supabaseKey) {
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
