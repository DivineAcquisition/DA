export type EngagementBase = 'da' | 'workspace';

/** The admin workspace and the legacy /da host render the same case file. */
export function engagementBase(pathname: string): EngagementBase {
  return pathname.startsWith('/workspace') ? 'workspace' : 'da';
}

export function engagementsHome(base: EngagementBase): string {
  return base === 'workspace' ? '/workspace/growth' : '/da';
}

export function newEngagementPath(base: EngagementBase): string {
  return base === 'workspace' ? '/workspace/growth/new' : '/da/new';
}

export function engagementPath(base: EngagementBase, slug: string, section = ''): string {
  const root = base === 'workspace' ? `/workspace/growth/${slug}` : `/da/${slug}`;
  return section ? `${root}/${section}` : root;
}
