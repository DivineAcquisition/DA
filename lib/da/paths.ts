import { headers } from 'next/headers';

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

export function growthSection(base: EngagementBase, section: 'billing' | 'payouts' | 'margin' | 'messages' | 'ingestion'): string {
  return base === 'workspace' ? `/workspace/growth/${section}` : `/da/${section}`;
}

/** Where this request is being rendered, so Growth links stay inside the tab. */
export async function requestEngagementBase(): Promise<EngagementBase> {
  const headerStore = await headers();
  const pathname = headerStore.get('x-pathname') ?? '';
  const referer = headerStore.get('referer') ?? '';
  if (pathname.startsWith('/workspace') || referer.includes('/workspace/growth')) return 'workspace';
  return 'da';
}
