/**
 * DivineACQ is two apps on one codebase and one database:
 *
 *   team app    VAs and SDRs (operator role). Only what they need to execute.
 *   admin app   owners, admins, managers. Where everything runs.
 *
 * Each app's address comes from configuration and nowhere else:
 *
 *   TEAM_APP_URL    e.g. https://team.divineacquisition.io
 *   ADMIN_APP_URL   e.g. https://admin.divineacquisition.io
 *
 * Changing either is a configuration change (plus DNS and the auth redirect
 * allow-list); no code names a domain. The older TEAM_BASE_URL / TEAM_HOSTS and
 * ADMIN_BASE_URL / DA_WORKSPACE_HOSTS variables are still read, so an existing
 * deploy keeps working while it moves to the two new names.
 *
 * Pure: safe to import from the proxy, server code and client code alike
 * (only NEXT_PUBLIC_ values are visible in the browser, so client code passes
 * URLs down from the server instead of reading these).
 */

export type AppKey = 'team' | 'admin';

const DEFAULTS: Record<AppKey, string> = {
  team: 'https://team.divineacquisition.io',
  admin: 'https://admin.divineacquisition.io',
};

function clean(url: string | undefined): string | null {
  const value = url?.trim().replace(/\/+$/, '');
  if (!value) return null;
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return '';
  }
}

function list(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

export function appUrl(app: AppKey, env: Record<string, string | undefined> = process.env): string {
  if (app === 'team') {
    return clean(env.TEAM_APP_URL) ?? clean(env.TEAM_BASE_URL) ?? (list(env.TEAM_HOSTS)[0] ? `https://${list(env.TEAM_HOSTS)[0]}` : DEFAULTS.team);
  }
  return (
    clean(env.ADMIN_APP_URL) ??
    clean(env.ADMIN_BASE_URL) ??
    (list(env.DA_WORKSPACE_HOSTS)[0] ? `https://${list(env.DA_WORKSPACE_HOSTS)[0]}` : DEFAULTS.admin)
  );
}

/** Every host that serves an app: its address, plus any extra configured hosts. */
export function appHosts(app: AppKey, env: Record<string, string | undefined> = process.env): string[] {
  const extra = app === 'team' ? list(env.TEAM_HOSTS) : list(env.DA_WORKSPACE_HOSTS);
  return [...new Set([hostOf(appUrl(app, env)), ...extra].filter(Boolean))];
}

export function appForHost(host: string, env: Record<string, string | undefined> = process.env): AppKey | null {
  const h = host.toLowerCase().split(':')[0];
  if (appHosts('team', env).includes(h)) return 'team';
  if (appHosts('admin', env).includes(h)) return 'admin';
  return null;
}

/** Who belongs in which app. One person, one role, one app. */
export const TEAM_ROLES = ['operator'] as const;
export const ADMIN_ROLES = ['owner', 'admin', 'manager'] as const;

export function appForRole(role: string | null | undefined): AppKey | null {
  if (role && (TEAM_ROLES as readonly string[]).includes(role)) return 'team';
  if (role && (ADMIN_ROLES as readonly string[]).includes(role)) return 'admin';
  return null;
}

/**
 * The team app's screens, as internal /vistrial paths: the VA portal, its
 * sign-in callback, password reset and the sign-out handoff. Everything else
 * under /vistrial is an admin screen.
 */
export function isTeamAppPath(internalPath: string): boolean {
  const prefixes = ['/vistrial/operator', '/vistrial/auth', '/vistrial/reset-password'];
  return internalPath === '/vistrial' || prefixes.some((p) => internalPath === p || internalPath.startsWith(`${p}/`));
}

/**
 * Session rules per app, in minutes. The admin app is stricter. Configurable;
 * these are the defaults proposed in Prompt 8B.
 */
export function sessionRules(app: AppKey, env: Record<string, string | undefined> = process.env): { idle: number; absolute: number } {
  const num = (value: string | undefined, fallback: number) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };
  return app === 'admin'
    ? { idle: num(env.ADMIN_IDLE_MINUTES, 30), absolute: num(env.ADMIN_SESSION_MAX_MINUTES, 12 * 60) }
    : { idle: num(env.TEAM_IDLE_MINUTES, 8 * 60), absolute: num(env.TEAM_SESSION_MAX_MINUTES, 7 * 24 * 60) };
}
