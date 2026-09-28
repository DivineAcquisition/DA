import { createClient } from '@/lib/supabase/server';

export type VaPerformanceRow = {
  operatorId: string;
  name: string;
  status: string;
  clientName: string | null;
  confirmedBookings: number;
  pendingBookings: number;
  quota: number;
  conversations: number;
  responseRate: number | null;
  eodReports: number;
};

export type VaOverview = {
  placed: number;
  inTraining: number;
  certified: number;
  onBench: number;
  confirmedBookings: number;
  pendingBookings: number;
  quota: number;
  conversations: number;
  withinStandard: number;
  eodReports: number;
  rows: VaPerformanceRow[];
  error: string | null;
};

const EMPTY: VaOverview = {
  placed: 0,
  inTraining: 0,
  certified: 0,
  onBench: 0,
  confirmedBookings: 0,
  pendingBookings: 0,
  quota: 0,
  conversations: 0,
  withinStandard: 0,
  eodReports: 0,
  rows: [],
  error: null,
};

function monthStartIso(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

function isCreditable(row: { state: string; source: string; matched_booking_id: string | null }) {
  if (row.state === 'system_only') return true;
  return row.state === 'confirmed' && !(row.source === 'manual' && row.matched_booking_id);
}

export function vaStatusLabel(status: string) {
  switch (status) {
    case 'in_training':
      return 'In training';
    case 'on_bench':
      return 'On bench';
    case 'applicant':
      return 'Applicant';
    case 'certified':
      return 'Certified';
    case 'placed':
      return 'Placed';
    case 'inactive':
      return 'Inactive';
    default:
      return status.replace(/_/g, ' ');
  }
}

export async function loadVaOverview(): Promise<VaOverview> {
  const supabase = await createClient();
  const since = monthStartIso();
  const sinceDay = since.slice(0, 10);

  const [operatorsResult, placementsResult] = await Promise.all([
    supabase.from('operator').select('id, name, status').order('name'),
    supabase
      .from('placement')
      .select('id, operator_id, case_file_id, monthly_booking_quota, status')
      .eq('status', 'active'),
  ]);

  if (operatorsResult.error) return { ...EMPTY, error: operatorsResult.error.message };
  if (placementsResult.error) return { ...EMPTY, error: placementsResult.error.message };

  const operators = operatorsResult.data ?? [];
  const placements = placementsResult.data ?? [];
  const placementIds = placements.map((row) => row.id);
  const caseIds = [...new Set(placements.map((row) => row.case_file_id))];

  const [casesResult, bookingsResult, eodResult, responseResult] = await Promise.all([
    caseIds.length
      ? supabase.from('client_case_file').select('id, name').in('id', caseIds)
      : Promise.resolve({ data: [], error: null }),
    placementIds.length
      ? supabase
          .from('booking')
          .select('placement_id, operator_id, state, source, matched_booking_id, scheduled_for')
          .gte('scheduled_for', since)
          .in('placement_id', placementIds)
      : Promise.resolve({ data: [], error: null }),
    placementIds.length
      ? supabase
          .from('eod_report')
          .select('placement_id, operator_id, shift_date')
          .gte('shift_date', sinceDay)
          .is('superseded_by_id', null)
          .in('placement_id', placementIds)
      : Promise.resolve({ data: [], error: null }),
    placementIds.length
      ? supabase
          .from('response_day')
          .select('placement_id, conversations, within_standard, day')
          .gte('day', sinceDay)
          .in('placement_id', placementIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const failure = casesResult.error ?? bookingsResult.error ?? eodResult.error ?? responseResult.error;
  if (failure) return { ...EMPTY, error: failure.message };

  const clientName = new Map((casesResult.data ?? []).map((row) => [row.id, row.name]));
  const byOperator = new Map<
    string,
    {
      clients: Set<string>;
      quota: number;
      confirmed: number;
      pending: number;
      conversations: number;
      within: number;
      eods: number;
    }
  >();

  function bucket(operatorId: string) {
    const existing = byOperator.get(operatorId);
    if (existing) return existing;
    const created = {
      clients: new Set<string>(),
      quota: 0,
      confirmed: 0,
      pending: 0,
      conversations: 0,
      within: 0,
      eods: 0,
    };
    byOperator.set(operatorId, created);
    return created;
  }

  for (const placement of placements) {
    const row = bucket(placement.operator_id);
    row.quota += placement.monthly_booking_quota ?? 0;
    const name = clientName.get(placement.case_file_id);
    if (name) row.clients.add(name);
  }

  for (const booking of bookingsResult.data ?? []) {
    const row = bucket(booking.operator_id);
    if (booking.state === 'pending_review') row.pending += 1;
    else if (isCreditable(booking)) row.confirmed += 1;
  }

  for (const report of eodResult.data ?? []) {
    bucket(report.operator_id).eods += 1;
  }

  for (const day of responseResult.data ?? []) {
    const placement = placements.find((item) => item.id === day.placement_id);
    if (!placement) continue;
    const row = bucket(placement.operator_id);
    row.conversations += day.conversations ?? 0;
    row.within += day.within_standard ?? 0;
  }

  const rows: VaPerformanceRow[] = operators
    .filter((operator) => operator.status !== 'inactive' && operator.status !== 'applicant')
    .map((operator) => {
      const stats = byOperator.get(operator.id);
      return {
        operatorId: operator.id,
        name: operator.name,
        status: operator.status,
        clientName: stats ? [...stats.clients].join(', ') || null : null,
        confirmedBookings: stats?.confirmed ?? 0,
        pendingBookings: stats?.pending ?? 0,
        quota: stats?.quota ?? 0,
        conversations: stats?.conversations ?? 0,
        responseRate:
          stats && stats.conversations > 0 ? stats.within / stats.conversations : null,
        eodReports: stats?.eods ?? 0,
      };
    })
    .sort((a, b) => {
      if (a.status === 'placed' && b.status !== 'placed') return -1;
      if (b.status === 'placed' && a.status !== 'placed') return 1;
      return b.confirmedBookings - a.confirmedBookings || a.name.localeCompare(b.name);
    });

  const totals = rows.reduce(
    (sum, row) => {
      sum.confirmedBookings += row.confirmedBookings;
      sum.pendingBookings += row.pendingBookings;
      sum.quota += row.quota;
      sum.conversations += row.conversations;
      sum.eodReports += row.eodReports;
      return sum;
    },
    { confirmedBookings: 0, pendingBookings: 0, quota: 0, conversations: 0, eodReports: 0 },
  );

  const withinStandard = [...byOperator.values()].reduce((sum, row) => sum + row.within, 0);

  return {
    placed: operators.filter((row) => row.status === 'placed').length,
    inTraining: operators.filter((row) => row.status === 'in_training').length,
    certified: operators.filter((row) => row.status === 'certified').length,
    onBench: operators.filter((row) => row.status === 'on_bench').length,
    confirmedBookings: totals.confirmedBookings,
    pendingBookings: totals.pendingBookings,
    quota: totals.quota,
    conversations: totals.conversations,
    withinStandard,
    eodReports: totals.eodReports,
    rows,
    error: null,
  };
}
