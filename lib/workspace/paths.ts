/**
 * On admin.divineacquisition.io the proxy rewrites bare paths into /workspace/*.
 * Links inside the surface should use bare paths so host URLs match the brief.
 * On localhost / preview, bare paths would miss the surface, so we prefix.
 */
export function workspacePath(path: string): string {
  const normalised = path.startsWith('/') ? path : `/${path}`;
  if (typeof window === 'undefined') {
    // Server: prefer host header stamp when present.
    return normalised;
  }
  const host = window.location.hostname.toLowerCase();
  const isWorkspaceHost =
    host === 'admin.divineacquisition.io' ||
    host.endsWith('.admin.divineacquisition.io');
  if (isWorkspaceHost) return normalised;
  if (normalised === '/') return '/workspace/recipients';
  if (normalised.startsWith('/workspace')) return normalised;
  if (normalised.startsWith('/p/') || normalised.startsWith('/c/')) return normalised;
  return `/workspace${normalised}`;
}

export function publicPageUrl(baseUrl: string, token: string): string {
  const base = baseUrl.replace(/\/+$/, '');
  return `${base}/p/${token}`;
}

export function publicCalendarUrl(baseUrl: string, token: string): string {
  const base = baseUrl.replace(/\/+$/, '');
  return `${base}/c/${token}`;
}
