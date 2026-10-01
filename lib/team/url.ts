/**
 * Links into the team app (VAs and SDRs). Its address is TEAM_APP_URL (see
 * lib/apps). On that host bare paths are rewritten into /vistrial by the proxy,
 * so <team>/operator serves /vistrial/operator. Admin screens are not served
 * there at all: they answer "not found".
 */

import { appHosts, appUrl, isTeamAppPath } from '../apps';

export const TEAM_PREFIX = '/vistrial';

export function teamHosts(): string[] {
  return appHosts('team');
}

export function teamOrigin(): string {
  return appUrl('team');
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

/** Kept for existing callers: the team app's paths (see lib/apps). */
export const isVaPortalPath = isTeamAppPath;
