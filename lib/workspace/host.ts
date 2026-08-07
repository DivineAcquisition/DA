/**
 * Host helpers for the unified Divine Acquisition admin portal.
 *
 * admin.divineacquisition.io serves agreements (/workspace), growth (/da),
 * control (/ad), assessment admin (/admin) and ops (/vistrial) under one
 * sidebar. Dedicated hosts (da.*, ad.*, ops.*) keep working for cutover.
 */

const WORKSPACE_HOST_FALLBACK = 'admin.divineacquisition.io';

export function workspaceHosts(): string[] {
  return (process.env.DA_WORKSPACE_HOSTS ?? WORKSPACE_HOST_FALLBACK)
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

export function isWorkspaceHost(host: string): boolean {
  const normalised = host.toLowerCase().split(':')[0] ?? '';
  return workspaceHosts().includes(normalised);
}

/** Admin surfaces co-hosted on the workspace portal — must not be rewritten. */
export function isUnifiedAdminPath(pathname: string): boolean {
  return (
    pathname === '/ad' ||
    pathname.startsWith('/ad/') ||
    pathname === '/da' ||
    pathname.startsWith('/da/') ||
    pathname === '/admin' ||
    pathname.startsWith('/admin/') ||
    pathname === '/vistrial' ||
    pathname.startsWith('/vistrial/')
  );
}
