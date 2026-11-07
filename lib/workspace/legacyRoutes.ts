/**
 * Old admin addresses and where each one lives now. One object, one URL: a
 * bookmark or an emailed link to a former screen lands on the desk that owns
 * that object. Pure, so the proxy and the tests share it.
 */

/** Top-level prefixes the app serves directly. Anything else on the admin host is a bare /workspace path. */
const ROUTED_PREFIXES = ['/workspace', '/ad', '/da', '/admin'];

/**
 * The admin host rewrites bare paths (/overview, /calls) into /workspace, so
 * the browser can show either form for the same screen.
 */
export function normalizePath(pathname: string): string {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (path === '/' || ROUTED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) return path;
  return `/workspace${path}`;
}

/** /workspace/growth/<x> and /da/<x> screens that are not a case file. */
const GROWTH_TOOLS = new Set(['billing', 'payouts', 'margin', 'messages', 'ingestion', 'pay-impact', 'new', 'auth', 'forgot-password', 'reset-password']);

type Rule = { from: RegExp; to: (match: RegExpExecArray) => string };

const id = '([^/]+)';

const RULES: Rule[] = [
  // Home
  { from: /^\/workspace$/, to: () => '/workspace/operators' },

  // Operators: hire, onboarding, and the three older rosters
  { from: /^\/workspace\/onboarding$/, to: () => '/workspace/operators/onboarding' },
  { from: /^\/workspace\/team\/workspace\/operators\/new$/, to: () => '/workspace/operators/applicants' },
  { from: /^\/workspace\/(?:team\/workspace|admin|ops)\/operators$/, to: () => '/workspace/operators' },
  { from: new RegExp(`^/workspace/(?:team/workspace|admin|ops)/operators/${id}$`), to: (m) => `/workspace/operators/${m[1]}` },

  // Clients: the pipeline, VA client admin, and the Growth home
  { from: /^\/workspace\/pipeline$/, to: () => '/workspace/clients/prospects' },
  { from: new RegExp(`^/workspace/pipeline/${id}$`), to: (m) => `/workspace/clients/prospects/${m[1]}` },
  { from: /^\/workspace\/(?:admin|ops)(?:\/clients)?$/, to: () => '/workspace/clients' },
  { from: new RegExp(`^/workspace/(?:admin|ops)/clients/${id}$`), to: (m) => `/workspace/clients/${m[1]}` },
  { from: /^\/(?:workspace\/growth|da)$/, to: () => '/workspace/clients' },
  { from: /^\/(?:workspace\/growth|da)\/new$/, to: () => '/workspace/clients/new' },
  {
    from: new RegExp(`^/(?:workspace/growth|da)/${id}$`),
    to: (m) => (GROWTH_TOOLS.has(m[1]) ? '' : `/workspace/clients/${m[1]}?tab=growth`),
  },

  // Placements
  { from: /^\/workspace\/(?:sales-ops|team\/workspace)\/placements$/, to: () => '/workspace/placements' },
  { from: /^\/workspace\/(?:sales-ops|team\/workspace)\/placements\/new$/, to: () => '/workspace/placements/new' },
  { from: new RegExp(`^/workspace/sales-ops/placements/${id}$`), to: (m) => `/workspace/placements/${m[1]}` },
  { from: /^\/workspace\/team\/workspace\/launches$/, to: () => '/workspace/placements/launches' },

  // Review
  { from: /^\/workspace\/(?:sales-ops|team\/workspace)\/eods$/, to: () => '/workspace/review/eods' },
  { from: new RegExp(`^/workspace/(?:sales-ops|team/workspace)/eods/${id}$`), to: (m) => `/workspace/review/eods/${m[1]}` },
  { from: /^\/workspace\/team\/workspace\/reports$/, to: () => '/workspace/review/reports' },
  {
    from: new RegExp(`^/workspace/team/workspace/reports/${id}$`),
    to: (m) => (m[1] === 'deliveries' ? '' : `/workspace/review/reports/${m[1]}`),
  },

  // System screens that moved with the one staff layout
  { from: /^\/workspace\/ops\/(payroll|escalations|bookings|notifications)$/, to: (m) => `/workspace/admin/${m[1]}` },
];

/**
 * The new address for an old admin path, or null when the path is current.
 * Takes the /workspace form (see normalizePath). A target may carry a query;
 * the caller merges the request's own query on top.
 */
export function legacyAdminRedirect(pathname: string): string | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  for (const rule of RULES) {
    const match = rule.from.exec(path);
    if (match) return rule.to(match) || null;
  }
  return null;
}
