/**
 * VA Ops Hub object model.
 *
 * The load-bearing relationship is Operator -> Placement -> Client. Work is
 * always logged against a placement, never directly against a client, so that
 * a client engagement can end without taking the operator's history with it.
 */

// ---------------------------------------------------------------------------
// Actors and access
// ---------------------------------------------------------------------------

export type Actor =
  | { role: 'admin'; id: string; name: string }
  | { role: 'operator'; id: string; name: string };

// ---------------------------------------------------------------------------
// Lifecycle states
// ---------------------------------------------------------------------------

export type OperatorStatus =
  | 'applicant'
  | 'in-training'
  | 'certified'
  | 'placed'
  | 'on-bench'
  | 'inactive';

/**
 * `expiring` is derived from the end date rather than stored, but it is part of
 * the vocabulary the admin works in, so it is modelled as a state.
 */
export type PlacementStatus = 'draft' | 'active' | 'expiring' | 'ended' | 'renewed';

export type OperatorTier = 1 | 2 | 3;

// ---------------------------------------------------------------------------
// Operator
// ---------------------------------------------------------------------------

export type Operator = {
  id: string;
  name: string;
  handle: string;
  email: string;
  phone: string;
  country: string;
  timeZone: string;
  status: OperatorStatus;
  tier: OperatorTier;
  /** Monthly base in whole dollars, before proration. */
  baseMonthly: number;
  certifiedOn: string | null;
  joinedOn: string;
  preferredChannel: NotificationChannel;
  trainingAssignments: TrainingAssignment[];
};

export type TrainingAssignment = {
  id: string;
  title: string;
  detail: string;
  completedOn: string | null;
};

// ---------------------------------------------------------------------------
// Client and case file configuration
// ---------------------------------------------------------------------------

export type IndustryId = 'med-spa' | 'cleaning' | 'coaching' | 'home-services' | 'generic';

export type EodFieldType = 'number' | 'text' | 'select' | 'boolean';

export type EodConfiguredField = {
  key: string;
  label: string;
  type: EodFieldType;
  options?: string[];
  required: boolean;
  help?: string;
};

export type CaseFileConfig = {
  industry: IndustryId;
  /** Appended below the locked core block on every EOD for this client. */
  configuredFields: EodConfiguredField[];
  shiftStart: string;
  shiftEnd: string;
  timeZone: string;
  monthlyBookingQuota: number;
  commissionPerBooking: number;
  /** Minutes an inbound conversation may wait before it breaks the standard. */
  responseStandardMinutes: number;
  escalationResponseHours: number;
  escalationContact: { name: string; role: string; channel: string } | null;
  qualifiedBookingDefinition: string;
};

export type Client = {
  id: string;
  name: string;
  vertical: string;
  onboardedOn: string;
  config: CaseFileConfig;
};

// ---------------------------------------------------------------------------
// Placement
// ---------------------------------------------------------------------------

export type Placement = {
  id: string;
  operatorId: string;
  clientId: string;
  startDate: string;
  /** Nominal term end. Three months from start unless overridden. */
  endDate: string;
  termMonths: number;
  status: Exclude<PlacementStatus, 'expiring'>;
  shiftStart: string;
  shiftEnd: string;
  timeZone: string;
  monthlyBookingQuota: number;
  commissionPerBooking: number;
  /** Set when the placement actually stopped, which may precede `endDate`. */
  closedOn: string | null;
  renewedFromId: string | null;
};

// ---------------------------------------------------------------------------
// EOD reports
// ---------------------------------------------------------------------------

/** The locked core. Identical for every client, every industry. */
export type EodCore = {
  shiftStartActual: string;
  shiftEndActual: string;
  conversationsHandled: number;
  appointmentsBooked: number;
  followUpsCompleted: number;
  escalationsRaised: number;
  blockers: string;
  notes: string;
};

export type EodReport = {
  id: string;
  placementId: string;
  operatorId: string;
  /** The shift the report covers, as a calendar date. */
  shiftDate: string;
  submittedAt: string;
  core: EodCore;
  configured: Record<string, string | number | boolean>;
  /** 1 for the original; corrections append higher versions. */
  version: number;
  /** Set on a superseded version, pointing at what replaced it. */
  supersededById: string | null;
  correctionReason: string | null;
  adminComments: AdminComment[];
};

export type AdminComment = {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

export type BookingSource = 'ghl' | 'manual';

/**
 * `confirmed` credits quota and commission. `pending-review` credits neither
 * until an admin approves it. `system-only` is a GHL booking the operator never
 * logged, which is auto-credited.
 */
export type BookingState = 'confirmed' | 'pending-review' | 'system-only' | 'rejected';

export type Booking = {
  id: string;
  placementId: string;
  operatorId: string;
  clientId: string;
  /** When the appointment itself is scheduled. */
  scheduledFor: string;
  /** When the record entered the system, from either source. */
  recordedAt: string;
  source: BookingSource;
  state: BookingState;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  /** Present on manual entries that were matched to an ingested event. */
  matchedBookingId: string | null;
  operatorNote: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  qualified: boolean;
};

// ---------------------------------------------------------------------------
// Escalations
// ---------------------------------------------------------------------------

export type EscalationCategory =
  | 'clinical'
  | 'pricing-exception'
  | 'complaint'
  | 'scheduling-conflict'
  | 'scope'
  | 'other';

export type EscalationStatus = 'open' | 'answered' | 'closed';

export type Escalation = {
  id: string;
  placementId: string;
  operatorId: string;
  clientId: string;
  category: EscalationCategory;
  customerContext: string;
  needed: string;
  status: EscalationStatus;
  raisedAt: string;
  /** Deadline derived from the case file's escalation response window. */
  responseDueAt: string;
  answeredAt: string | null;
  answer: string | null;
  answeredBy: string | null;
  closedAt: string | null;
  routedTo: string[];
};

// ---------------------------------------------------------------------------
// Scope requests and admin notes
// ---------------------------------------------------------------------------

export type ScopeRequest = {
  id: string;
  clientId: string;
  placementId: string | null;
  requestedBy: string;
  summary: string;
  detail: string;
  status: 'open' | 'approved' | 'declined';
  createdAt: string;
  resolvedAt: string | null;
  resolution: string | null;
};

export type AdminNote = {
  id: string;
  clientId: string;
  placementId: string | null;
  authorName: string;
  body: string;
  createdAt: string;
};

export type Evidence = {
  id: string;
  clientId: string;
  placementId: string;
  label: string;
  kind: 'screenshot' | 'recording' | 'transcript' | 'document';
  uploadedBy: string;
  uploadedAt: string;
  sizeLabel: string;
};

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export type NotificationChannel = 'in-app' | 'discord' | 'email' | 'whatsapp';

export type NotificationSeverity = 'informational' | 'important' | 'urgent';

export type DeliveryStatus = 'delivered' | 'failed' | 'skipped';

export type DeliveryAttempt = {
  channel: NotificationChannel;
  status: DeliveryStatus;
  attemptedAt: string;
  detail: string | null;
};

export type Notification = {
  id: string;
  operatorId: string;
  severity: NotificationSeverity;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  /** Every send attempt, in the order the engine tried them. */
  attempts: DeliveryAttempt[];
  sentBy: string;
  relatedPlacementId: string | null;
};

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export type OperatorTask = {
  id: string;
  operatorId: string;
  placementId: string | null;
  title: string;
  detail: string;
  dueOn: string | null;
  completedOn: string | null;
  assignedBy: string;
};

// ---------------------------------------------------------------------------
// Pay
// ---------------------------------------------------------------------------

export type PayPeriod = {
  id: string;
  /** Inclusive. */
  start: string;
  /** Inclusive. */
  end: string;
  /** True for the second half of a month, when monthly items settle. */
  closesMonth: boolean;
  status: 'open' | 'closed';
  closedAt: string | null;
};

export type PayAdjustment = {
  id: string;
  statementId: string;
  label: string;
  reason: string;
  /** Positive or negative, in whole dollars. */
  amount: number;
  addedBy: string;
  addedAt: string;
};

export type PayStatementLine = {
  label: string;
  detail: string;
  amount: number;
};

export type PayStatement = {
  id: string;
  operatorId: string;
  placementId: string;
  periodId: string;
  baseAmount: number;
  baseDetail: string;
  commissionAmount: number;
  commissionDetail: string;
  /** Booking ids that produced the commission, so the operator can audit it. */
  commissionBookingIds: string[];
  speedBonusAmount: number;
  speedBonusDetail: string;
  adjustments: PayAdjustment[];
  total: number;
  /** A closed statement is an immutable record. */
  locked: boolean;
  lockedAt: string | null;
};

// ---------------------------------------------------------------------------
// Derived reporting shapes
// ---------------------------------------------------------------------------

export type PlacementMetrics = {
  placementId: string;
  responseComplianceRate: number;
  conversationsHandled: number;
  confirmedBookings: number;
  pendingBookings: number;
  monthlyQuota: number;
  quotaProgress: number;
  daysRemainingInPeriod: number;
  eodSubmissionRate: number;
  missedEodDates: string[];
  openEscalations: number;
  overdueEscalations: number;
};

export type ExceptionSeverity = 'critical' | 'warning';

export type ExceptionKind =
  | 'escalation-overdue'
  | 'response-below-standard'
  | 'missed-eod'
  | 'booking-review'
  | 'quota-at-risk'
  | 'placement-expiring';

export type Exception = {
  id: string;
  kind: ExceptionKind;
  severity: ExceptionSeverity;
  title: string;
  detail: string;
  operatorId: string | null;
  clientId: string | null;
  placementId: string | null;
  href: string;
  /** Lower sorts first. Fixed by kind so the queue order never drifts. */
  rank: number;
};

// ---------------------------------------------------------------------------
// The database shape
// ---------------------------------------------------------------------------

/**
 * Response-time samples per placement per day. In production these come from
 * the GHL ingestion; the shape is kept separate because it is high-volume.
 */
export type ResponseDay = {
  placementId: string;
  date: string;
  conversations: number;
  withinStandard: number;
};

export type OpsData = {
  operators: Operator[];
  clients: Client[];
  placements: Placement[];
  eodReports: EodReport[];
  bookings: Booking[];
  escalations: Escalation[];
  scopeRequests: ScopeRequest[];
  adminNotes: AdminNote[];
  evidence: Evidence[];
  notifications: Notification[];
  tasks: OperatorTask[];
  payPeriods: PayPeriod[];
  payStatements: PayStatement[];
  responseDays: ResponseDay[];
  /** Fixed "today" so the seeded exception queue is deterministic. */
  now: string;
};
