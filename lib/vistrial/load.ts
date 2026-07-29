import { createClient } from '@/lib/supabase/server';
import type {
  Booking,
  Client,
  EodConfiguredField,
  EodReport,
  Escalation,
  Notification,
  Operator,
  OperatorTask,
  OpsData,
  PayPeriod,
  PayStatement,
  Placement,
  ResponseDay,
} from './types';

/**
 * Loads the operator hub from Postgres into the shape the gateway, the rule
 * functions and the UI already consume. The database uses snake_case enum values
 * and the domain model uses hyphens, so the mapping happens here in one place
 * rather than being spread through the components.
 */

const hyphen = (value: string) => value.replace(/_/g, '-');

/** The configuration tables are ahead of the checked-in Database types. */
type UntypedQuery = PromiseLike<{ data: unknown; error: { message: string } | null }> & {
  select: (columns: string) => UntypedQuery;
  order: (column: string) => UntypedQuery;
};

const untyped = (client: unknown) =>
  client as unknown as { from: (table: string) => UntypedQuery };

type FieldRow = {
  key: string;
  label: string;
  field_type: EodConfiguredField['type'];
  options: string[] | null;
  required: boolean;
  help: string | null;
};

export async function loadOpsData(): Promise<OpsData> {
  const supabase = await createClient();

  const [
    { data: operators },
    { data: clients },
    { data: placements },
    { data: eods },
    { data: bookings },
    { data: escalations },
    { data: scopeRequests },
    { data: decisions },
    { data: evidence },
    { data: notifications },
    { data: tasks },
    { data: payPeriods },
    { data: statements },
    { data: responseDays },
    { data: templates },
    { data: templateFields },
    { data: clientFields },
    { data: staff },
  ] = await Promise.all([
    supabase.from('operator').select('*, operator_training(id, title, detail, completed_on)').order('name'),
    supabase.from('client_case_file').select('*').order('name'),
    supabase.from('placement').select('*'),
    supabase.from('eod_report').select('*, eod_comment(id, author_name, body, created_at)'),
    supabase.from('booking').select('*'),
    supabase.from('escalation').select('*'),
    supabase.from('scope_request').select('*'),
    supabase.from('decision').select('*'),
    supabase.from('evidence_item').select('*'),
    supabase
      .from('operator_notification')
      .select('*, notification_attempt(channel, status, attempted_at, detail)'),
    supabase.from('operator_task').select('*'),
    supabase.from('pay_period').select('*').order('start_date'),
    supabase.from('pay_statement').select('*, pay_adjustment(id, label, reason, amount, added_by, added_at)'),
    supabase.from('response_day').select('*'),
    // The industry templates and any per-client overrides. Configuration, so it
    // is read rather than compiled in: adding an industry is a row.
    untyped(supabase).from('industry_template').select('key, name').order('sort_order'),
    untyped(supabase)
      .from('industry_template_field')
      .select('template_key, key, label, field_type, options, required, help, sort_order')
      .order('sort_order'),
    untyped(supabase)
      .from('case_file_eod_field')
      .select('case_file_id, key, label, field_type, options, required, help, sort_order')
      .order('sort_order'),
    // Names only. The hub used to print 'DA Admin' for whoever assigned a task or
    // adjusted a statement, because an operator cannot read the profile table.
    untyped(supabase).from('v_staff_name').select('profile_id, display_name').order('display_name'),
  ]);

  const now = new Date().toISOString();

  const staffRows = (staff ?? []) as { profile_id: string; display_name: string }[];
  const staffNames = new Map(staffRows.map((row) => [row.profile_id, row.display_name]));

  const industryNames = new Map<string, string>(
    ((templates ?? []) as { key: string; name: string }[]).map((row) => [row.key, row.name]),
  );

  const toField = (row: FieldRow): EodConfiguredField => ({
    key: row.key,
    label: row.label,
    type: row.field_type,
    options: row.options ?? undefined,
    required: row.required,
    help: row.help ?? undefined,
  });

  const fieldsByTemplate = new Map<string, EodConfiguredField[]>();
  for (const row of (templateFields ?? []) as (FieldRow & { template_key: string })[]) {
    const list = fieldsByTemplate.get(row.template_key) ?? [];
    list.push(toField(row));
    fieldsByTemplate.set(row.template_key, list);
  }

  const fieldsByCaseFile = new Map<string, EodConfiguredField[]>();
  for (const row of (clientFields ?? []) as (FieldRow & { case_file_id: string })[]) {
    const list = fieldsByCaseFile.get(row.case_file_id) ?? [];
    list.push(toField(row));
    fieldsByCaseFile.set(row.case_file_id, list);
  }

  return {
    now,
    staffNames: staffRows.map((row) => row.display_name),
    operators: (operators ?? []).map(
      (row): Operator => ({
        id: row.id,
        name: row.name,
        handle: row.handle ?? row.email.split('@')[0],
        email: row.email,
        phone: row.phone ?? '',
        country: row.country ?? '',
        timeZone: row.time_zone,
        status: hyphen(row.status) as Operator['status'],
        tier: row.tier as Operator['tier'],
        baseMonthly: Number(row.base_monthly),
        certifiedOn: row.certified_on,
        joinedOn: row.joined_on ?? row.created_at.slice(0, 10),
        preferredChannel: hyphen(row.preferred_channel) as Operator['preferredChannel'],
        trainingAssignments: (
          (row.operator_training ?? []) as {
            id: string;
            title: string;
            detail: string;
            completed_on: string | null;
          }[]
        ).map((item) => ({
          id: item.id,
          title: item.title,
          detail: item.detail,
          completedOn: item.completed_on,
        })),
      }),
    ),

    clients: (clients ?? []).map((row): Client => {
      const placement = (placements ?? []).find((item) => item.case_file_id === row.id);
      const config = row as typeof row & {
        industry_key: string;
        qualified_booking_definition: string | null;
        contact_role: string | null;
        contact_channel: string | null;
      };

      // An override replaces the template rather than adding to it, which is the
      // same resolution eod_fields_for_case_file() performs in the database.
      const configuredFields =
        fieldsByCaseFile.get(row.id) ?? fieldsByTemplate.get(config.industry_key) ?? [];

      return {
        id: row.id,
        name: row.name,
        vertical: row.vertical ?? '',
        onboardedOn: row.engagement_start ?? row.created_at.slice(0, 10),
        config: {
          industry: config.industry_key,
          industryName: industryNames.get(config.industry_key) ?? config.industry_key,
          configuredFields,
          // The placement owns the operating window and the commercial terms.
          // Nothing is invented here when it has none: a client with no live
          // placement has no shift, and saying so beats showing 09:00.
          shiftStart: placement?.shift_start ?? null,
          shiftEnd: placement?.shift_end ?? null,
          timeZone: placement?.time_zone ?? null,
          monthlyBookingQuota: placement?.monthly_booking_quota ?? null,
          commissionPerBooking:
            placement?.commission_per_booking === undefined
              ? null
              : Number(placement.commission_per_booking),
          responseStandardMinutes: placement?.response_standard_minutes ?? null,
          escalationResponseHours: placement?.escalation_response_hours ?? null,
          escalationContact: row.contact_name
            ? {
                name: row.contact_name,
                role: config.contact_role,
                channel: config.contact_channel,
              }
            : null,
          qualifiedBookingDefinition: config.qualified_booking_definition,
        },
      };
    }),

    placements: (placements ?? []).map(
      (row): Placement => ({
        id: row.id,
        operatorId: row.operator_id,
        clientId: row.case_file_id,
        startDate: row.start_date,
        endDate: row.end_date,
        termMonths: row.term_months,
        status: row.status as Placement['status'],
        shiftStart: row.shift_start,
        shiftEnd: row.shift_end,
        timeZone: row.time_zone,
        monthlyBookingQuota: row.monthly_booking_quota,
        commissionPerBooking: Number(row.commission_per_booking),
        closedOn: row.closed_on,
        renewedFromId: row.renewed_from_id,
      }),
    ),

    eodReports: (eods ?? []).map(
      (row): EodReport => ({
        id: row.id,
        placementId: row.placement_id,
        operatorId: row.operator_id,
        shiftDate: row.shift_date,
        submittedAt: row.submitted_at,
        core: {
          shiftStartActual: row.shift_start_actual,
          shiftEndActual: row.shift_end_actual,
          conversationsHandled: row.conversations_handled,
          appointmentsBooked: row.appointments_booked,
          followUpsCompleted: row.follow_ups_completed,
          escalationsRaised: row.escalations_raised,
          blockers: row.blockers,
          notes: row.notes,
        },
        configured: (row.configured ?? {}) as Record<string, string | number | boolean>,
        version: row.version,
        supersededById: row.superseded_by_id,
        correctionReason: row.correction_reason,
        adminComments: (
          (row.eod_comment ?? []) as {
            id: string;
            author_name: string;
            body: string;
            created_at: string;
          }[]
        ).map((comment) => ({
          id: comment.id,
          authorName: comment.author_name,
          body: comment.body,
          createdAt: comment.created_at,
        })),
      }),
    ),

    bookings: (bookings ?? []).map(
      (row): Booking => ({
        id: row.id,
        placementId: row.placement_id,
        operatorId: row.operator_id,
        clientId: row.case_file_id,
        scheduledFor: row.scheduled_for,
        recordedAt: row.recorded_at,
        source: row.source as Booking['source'],
        state: hyphen(row.state) as Booking['state'],
        customerName: row.customer_name,
        customerPhone: row.customer_phone,
        // Now that booking carries an email, isSameAppointment() can use it. It
        // is the identifier GoHighLevel sends most reliably, so this was the arm
        // of the match that was unreachable while the column did not exist.
        customerEmail: (row as { customer_email?: string | null }).customer_email ?? null,
        matchedBookingId: row.matched_booking_id,
        operatorNote: row.operator_note,
        reviewedBy: row.reviewed_by,
        reviewedAt: row.reviewed_at,
        rejectionReason: row.rejection_reason,
        qualified: row.state !== 'rejected',
      }),
    ),

    escalations: (escalations ?? []).map(
      (row): Escalation => ({
        id: row.id,
        placementId: row.placement_id,
        operatorId: row.operator_id,
        clientId: row.case_file_id,
        category: hyphen(row.category) as Escalation['category'],
        customerContext: row.customer_context,
        needed: row.needed,
        status: row.status as Escalation['status'],
        raisedAt: row.raised_at,
        responseDueAt: row.response_due_at,
        answeredAt: row.answered_at,
        answer: row.answer,
        answeredBy: row.answered_by,
        closedAt: row.closed_at,
        routedTo: row.routed_to,
      }),
    ),

    scopeRequests: (scopeRequests ?? []).map((row) => ({
      id: row.id,
      clientId: row.case_file_id,
      placementId: null,
      requestedBy: row.requested_by_name ?? 'Client',
      summary: row.summary,
      detail: row.detail ?? '',
      status: (row.verdict === 'in_scope' ? 'approved' : 'open') as 'open' | 'approved' | 'declined',
      createdAt: row.created_at,
      resolvedAt: null,
      resolution: row.reason,
    })),

    // The hub's internal notes are DA's decisions log, which is the record that
    // matters if an engagement goes badly.
    adminNotes: (decisions ?? []).map((row) => ({
      id: row.id,
      clientId: row.case_file_id,
      placementId: null,
      authorName: row.decided_by,
      body: `${row.what_was_decided} — ${row.reasoning}`,
      createdAt: row.created_at,
    })),

    evidence: (evidence ?? []).map((row) => ({
      id: row.id,
      clientId: row.case_file_id,
      placementId: '',
      label: row.what_it_proves ?? row.filename,
      kind: (row.mime_type?.startsWith('image')
        ? 'screenshot'
        : row.mime_type?.startsWith('video')
          ? 'recording'
          : 'document') as 'screenshot' | 'recording' | 'transcript' | 'document',
      uploadedBy: row.uploaded_by_client ? 'client' : 'da',
      uploadedAt: row.uploaded_at,
      sizeLabel: row.byte_size ? `${Math.round(Number(row.byte_size) / 1024)} KB` : '—',
    })),

    notifications: (notifications ?? []).map(
      (row): Notification => ({
        id: row.id,
        operatorId: row.operator_id,
        severity: row.severity as Notification['severity'],
        title: row.title,
        body: row.body,
        createdAt: row.created_at,
        readAt: row.read_at,
        sentBy: row.sent_by,
        relatedPlacementId: row.placement_id,
        attempts: (
          (row.notification_attempt ?? []) as {
            channel: string;
            status: string;
            attempted_at: string;
            detail: string | null;
          }[]
        ).map((attempt) => ({
          channel: hyphen(attempt.channel) as Notification['attempts'][number]['channel'],
          status: attempt.status as Notification['attempts'][number]['status'],
          attemptedAt: attempt.attempted_at,
          detail: attempt.detail,
        })),
      }),
    ),

    tasks: (tasks ?? []).map(
      (row): OperatorTask => ({
        id: row.id,
        operatorId: row.operator_id,
        placementId: row.placement_id,
        title: row.title,
        detail: row.detail,
        dueOn: row.due_on,
        completedOn: row.completed_on,
        assignedBy: row.assigned_by ? staffNames.get(row.assigned_by) ?? null : null,
      }),
    ),

    payPeriods: (payPeriods ?? []).map(
      (row): PayPeriod => ({
        id: row.id,
        start: row.start_date,
        end: row.end_date,
        closesMonth: row.closes_month,
        status: row.status as PayPeriod['status'],
        closedAt: row.closed_at,
      }),
    ),

    payStatements: (statements ?? []).map(
      (row): PayStatement => ({
        id: row.id,
        operatorId: row.operator_id,
        placementId: row.placement_id,
        periodId: row.period_id,
        baseAmount: Number(row.base_amount),
        baseDetail: row.base_detail ?? '',
        commissionAmount: Number(row.commission_amount),
        commissionDetail: row.commission_detail ?? '',
        commissionBookingIds: row.commission_booking_ids,
        speedBonusAmount: Number(row.speed_bonus_amount),
        speedBonusDetail: row.speed_bonus_detail ?? '',
        adjustments: (
          (row.pay_adjustment ?? []) as {
            id: string;
            label: string;
            reason: string;
            amount: number;
            added_by: string | null;
            added_at: string;
          }[]
        ).map((adjustment) => ({
          id: adjustment.id,
          statementId: row.id,
          label: adjustment.label,
          reason: adjustment.reason,
          amount: Number(adjustment.amount),
          addedBy: adjustment.added_by ? staffNames.get(adjustment.added_by) ?? null : null,
          addedAt: adjustment.added_at,
        })),
        total: Number(row.total),
        locked: row.locked,
        lockedAt: row.locked_at,
      }),
    ),

    responseDays: (responseDays ?? []).map(
      (row): ResponseDay => ({
        placementId: row.placement_id,
        date: row.day,
        conversations: row.conversations,
        withinStandard: row.within_standard,
      }),
    ),
  };
}
