/** Paths a manager may open. GHL connections, the operator-workspace domain, data integrity, and deliveries stay out. */
const BLOCKED_PREFIXES = [
  '/workspace/team/ghl',
  '/workspace/team/settings',
  '/workspace/team/workspace/integrity',
  '/workspace/team/workspace/reports/deliveries',
];

export function managerPathAllowed(pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (BLOCKED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) return false;
  if (path.startsWith('/workspace/sales-ops') && !path.startsWith('/workspace/sales-ops/placements')) return false;
  return (
    path.startsWith('/workspace/operations') ||
    path.startsWith('/workspace/inbox') ||
    path.startsWith('/workspace/team') ||
    path.startsWith('/workspace/sales-ops/placements')
  );
}
