/**
 * The staff app's permanent address: team.divineacquisition.io.
 *
 * On that host, bare paths are rewritten into /vistrial by the proxy, so
 * team.divineacquisition.io/operator serves /vistrial/operator. Old addresses
 * (ops., vistrial., and /vistrial on admin.) redirect here with the path preserved.
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
