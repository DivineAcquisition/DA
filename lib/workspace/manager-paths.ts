/** Paths a manager may open. The client file, invites, and the GoHighLevel token stay with DA Admin. */
const BLOCKED_PREFIXES = [
  '/workspace/clients',
  '/workspace/control',
  '/workspace/team/ghl',
  '/workspace/operators/applicants',
];

/** The desks a manager works: the live seat, review, and the operator record. */
const ALLOWED_PREFIXES = ['/workspace/operators', '/workspace/placements', '/workspace/review'];

export function managerPathAllowed(pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  const under = (prefix: string) => path === prefix || path.startsWith(`${prefix}/`);
  if (BLOCKED_PREFIXES.some(under)) return false;
  return ALLOWED_PREFIXES.some(under);
}
