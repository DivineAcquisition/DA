import { type CallStatus } from './calls';
import { familyLabel, nicheFamily, nicheLabel, type NicheFamily, type WorkspaceNiche } from './niches';
import { type PracticeStage } from './practices';

export type WorkspaceCallListRow = {
  id: string;
  family: NicheFamily;
  contact_name: string;
  account_name: string;
  niche: WorkspaceNiche;
  size_label: string;
  status: CallStatus;
  created_at: string;
  href: string;
};

export type WorkspaceAccountListRow = {
  id: string;
  family: NicheFamily;
  name: string;
  contact_name: string;
  niche: WorkspaceNiche;
  stage: PracticeStage;
  revenue: number | null;
  created_at: string;
  href: string;
};

export function matchesWorkspaceSearch(
  row: { contact_name: string; account_name?: string; name?: string; niche: WorkspaceNiche },
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [
    row.contact_name,
    row.account_name ?? '',
    row.name ?? '',
    nicheLabel(row.niche),
    familyLabel(nicheFamily(row.niche)),
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}
