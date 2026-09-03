import { CALLS_PUBLIC_ORIGIN } from './config';

export function isCallsHost(host?: string | null): boolean {
  const hostname = (host ?? '').toLowerCase().split(':')[0];
  if (!hostname) return false;
  const callsHost = new URL(CALLS_PUBLIC_ORIGIN).hostname;
  return (
    hostname === callsHost ||
    (hostname.startsWith('calls.') && hostname.endsWith('.divineacquisition.io'))
  );
}

/** Empty on the dedicated host so URLs stay at the root; `/calls` everywhere else. */
export function callsBasePath(host?: string | null): string {
  return isCallsHost(host) ? '' : '/calls';
}

export function callsPath(suffix: string, host?: string | null): string {
  const path = suffix.startsWith('/') ? suffix : `/${suffix}`;
  const base = callsBasePath(host);
  if (path === '/') return base || '/';
  return `${base}${path}`;
}
