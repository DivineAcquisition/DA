/**
 * team.divineacquisition.io is the VA and SDR portal, nothing else.
 *
 * On that host, bare paths are rewritten into /vistrial by the proxy, so
 * team.divineacquisition.io/operator serves /vistrial/operator. Staff screens
 * (team board, queues, GHL, the admin views) live on the admin portal at
 * admin.divineacquisition.io/vistrial; a staff path asked for on the team host
 * redirects there with the path preserved.
 */

const FALLBACK_HOST = 'team.divineacquisition.io';

export const TEAM_PREFIX = '/vistrial';

export function teamHosts(): string[] {
  return (process.env.TEAM_HOSTS ?? FALLBACK_HOST)
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

export function teamOrigin(): string {
  const configured = process.env.TEAM_BASE_URL?.trim().replace(/\/+$/, '');
  return configured || `https://${teamHosts()[0] ?? FALLBACK_HOST}`;
}

/** The public path on the team host for an internal /vistrial path. */
export function teamPath(pathname: string): string {
  if (pathname === TEAM_PREFIX) return '/';
  if (pathname.startsWith(`${TEAM_PREFIX}/`)) return pathname.slice(TEAM_PREFIX.length);
  return pathname.startsWith('/') ? pathname : `/${pathname}`;
}

/** An absolute link into the staff app, for emails and other surfaces. */
export function teamUrl(pathname = '/', search = ''): string {
  return `${teamOrigin()}${teamPath(pathname)}${search}`;
}

/**
 * What the team host serves: the VA portal, its sign-in and password reset.
 * Everything else under /vistrial is a staff screen and lives on the admin portal.
 */
export function isVaPortalPath(internalPath: string): boolean {
  const vaPrefixes = ['/vistrial/operator', '/vistrial/auth', '/vistrial/reset-password', '/vistrial/login'];
  return internalPath === TEAM_PREFIX || vaPrefixes.some((p) => internalPath === p || internalPath.startsWith(`${p}/`));
}
