import { listCalls } from './call-queries';
import { frontDeskLabel } from './calls';
import { listHsCalls } from './hs-call-queries';
import { hsCrewCountLabel } from './hs-calls';
import { listHsCompanies } from './hs-company-queries';
import { listPractices } from './practice-queries';
import { type PracticeStage } from './practices';
import {
  type WorkspaceAccountListRow,
  type WorkspaceCallListRow,
} from './workspace-list-types';

export type { WorkspaceAccountListRow, WorkspaceCallListRow } from './workspace-list-types';
export { matchesWorkspaceSearch } from './workspace-list-types';

export async function listWorkspaceCalls(): Promise<WorkspaceCallListRow[]> {
  const [practiceCalls, hsCalls] = await Promise.all([listCalls(), listHsCalls()]);
  const rows: WorkspaceCallListRow[] = [
    ...practiceCalls.map((call) => ({
      id: call.id,
      family: 'practice' as const,
      contact_name: call.contact_name,
      account_name: call.practice_name,
      niche: call.practice_type,
      size_label: frontDeskLabel(call.front_desk_size),
      status: call.status,
      created_at: call.created_at,
      href: `/workspace/calls/${call.id}`,
    })),
    ...hsCalls.map((call) => ({
      id: call.id,
      family: 'home_services' as const,
      contact_name: call.contact_name,
      account_name: call.company_name,
      niche: call.trade,
      size_label: hsCrewCountLabel(call.crew_count),
      status: call.status,
      created_at: call.created_at,
      href: `/workspace/hs/calls/${call.id}`,
    })),
  ];
  return rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function listWorkspaceAccounts(): Promise<WorkspaceAccountListRow[]> {
  const [practices, companies] = await Promise.all([listPractices(), listHsCompanies()]);
  const rows: WorkspaceAccountListRow[] = [
    ...practices.map((row) => ({
      id: row.id,
      family: 'practice' as const,
      name: row.practice_name,
      contact_name: row.contact_name,
      niche: row.practice_type,
      stage: row.stage,
      revenue: row.dormant_revenue,
      created_at: row.created_at,
      href: `/workspace/practices/${row.id}/audit`,
    })),
    ...companies.map((row) => ({
      id: row.id,
      family: 'home_services' as const,
      name: row.company_name,
      contact_name: row.contact_name,
      niche: row.trade,
      stage: row.stage as PracticeStage,
      revenue: row.idle_revenue,
      created_at: row.created_at,
      href: `/workspace/hs/companies/${row.id}/audit`,
    })),
  ];
  return rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
}
