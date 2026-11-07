/** Paths a manager may open. GHL connections, the operator-workspace domain, data integrity, and deliveries stay out. */
const BLOCKED_PREFIXES = [
  '/workspace/team/ghl',
  '/workspace/team/settings',
  '/workspace/team/workspace/integrity',
  '/workspace/team/workspace/reports/deliveries',
  // Applicants are DA Admin's: advancing one is a hire.
  '/workspace/operators/applicants',
];

/** The desks a manager works, plus their team tools. */
const ALLOWED_PREFIXES = [
  '/workspace/operators',
  '/workspace/placements',
  '/workspace/review',
  '/workspace/operations',
  '/workspace/inbox',
  '/workspace/team',
];

export function managerPathAllowed(pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  const under = (prefix: string) => path === prefix || path.startsWith(`${prefix}/`);
  if (BLOCKED_PREFIXES.some(under)) return false;
  return ALLOWED_PREFIXES.some(under);
}
