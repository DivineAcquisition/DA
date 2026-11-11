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

const id = '([^/]+)';

type Rule = { from: RegExp; to: (match: RegExpExecArray) => string };

const RULES: Rule[] = [
  // Home is the live seat.
  { from: /^\/workspace$/, to: () => '/workspace/placements' },

  // Operator queues that are no longer a desk.
  { from: /^\/workspace\/onboarding$/, to: () => '/workspace/operators' },
  { from: /^\/workspace\/team\/workspace\/operators\/new$/, to: () => '/workspace/operators' },
  { from: /^\/workspace\/(?:team\/workspace|admin|ops)\/operators$/, to: () => '/workspace/operators' },
  { from: new RegExp(`^/workspace/(?:team/workspace|admin|ops)/operators/${id}$`), to: (m) => `/workspace/operators/${m[1]}` },
  { from: new RegExp(`^/workspace/team/operator/${id}$`), to: (m) => `/workspace/operators/${m[1]}` },

  // Client file. Prospects, growth, and the old admin client screens land here.
  // The Pipeline is its own desk again (inquiries, bookings, discovery calls).
  { from: /^\/workspace\/clients\/prospects(?:\/.*)?$/, to: () => '/workspace/clients' },
  { from: /^\/workspace\/(?:admin|ops)(?:\/clients)?$/, to: () => '/workspace/clients' },
  { from: new RegExp(`^/workspace/(?:admin|ops)/clients/${id}$`), to: (m) => `/workspace/clients/${m[1]}` },
  { from: /^\/workspace\/admin\/(?:escalations|bookings|notifications)$/, to: () => '/workspace/clients' },
  { from: /^\/(?:workspace\/growth|da)$/, to: () => '/workspace/clients' },
  { from: /^\/(?:workspace\/growth|da)\/(?:new|billing|payouts|margin|messages|ingestion|pay-impact)(?:\/.*)?$/, to: () => '/workspace/clients' },
  {
    from: /^\/(?:workspace\/growth|da)\/(?!auth(?:\/|$)|forgot-password(?:\/|$)|reset-password(?:\/|$))([^/]+)(?:\/.*)?$/,
    to: (m) => `/workspace/clients/${m[1]}`,
  },

  // The live seat. Launches and the old placement URLs land on the list.
  { from: /^\/workspace\/placements\/launches(?:\/.*)?$/, to: () => '/workspace/placements' },
  { from: /^\/workspace\/(?:sales-ops|team\/workspace)\/placements$/, to: () => '/workspace/placements' },
  { from: /^\/workspace\/(?:sales-ops|team\/workspace)\/placements\/new$/, to: () => '/workspace/placements/new' },
  { from: new RegExp(`^/workspace/sales-ops/placements/${id}$`), to: (m) => `/workspace/placements/${m[1]}` },
  { from: /^\/workspace\/team\/workspace\/launches$/, to: () => '/workspace/placements' },

  // Review.
  { from: /^\/workspace\/(?:sales-ops|team\/workspace)\/eods$/, to: () => '/workspace/review/eods' },
  { from: new RegExp(`^/workspace/(?:sales-ops|team/workspace)/eods/${id}$`), to: (m) => `/workspace/review/eods/${m[1]}` },
  { from: /^\/workspace\/team\/workspace\/reports$/, to: () => '/workspace/review/reports' },
  { from: /^\/workspace\/team\/workspace\/reports\/deliveries(?:\/.*)?$/, to: () => '/workspace/review/reports' },
  { from: new RegExp(`^/workspace/team/workspace/reports/${id}$`), to: (m) => `/workspace/review/reports/${m[1]}` },

  // Account: the operator record, invites, and the one GoHighLevel screen.
  { from: /^\/workspace\/academy(?:\/.*)?$/, to: () => '/workspace/operators' },
  { from: /^\/workspace\/admin\/view-as(?:\/.*)?$/, to: () => '/workspace/operators' },
  { from: /^\/workspace\/admin\/payroll$/, to: () => '/workspace/clients' },
  { from: /^\/workspace\/team\/ghl\/(?!client(?:\/|$)).+$/, to: () => '/workspace/team/ghl' },
  { from: /^\/workspace\/control\/(?!invites$).+$/, to: () => '/workspace/control/invites' },
  { from: /^\/workspace\/control$/, to: () => '/workspace/control/invites' },
  { from: /^\/workspace\/team(?:\/(?:board|queues|matching|scorecard|settings|workspace)(?:\/.*)?)?$/, to: () => '/workspace/operators' },

  // Everything else that used to sit in System.
  {
    from: /^\/workspace\/(?:calls|hs|practices|accounts|overview|bookings|booking-messages|calendar-links|acq-applications|agreements|recipients|templates|mapping|settings|sales-ops|inbox|operations)(?:\/.*)?$/,
    to: () => '/workspace/placements',
  },
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
