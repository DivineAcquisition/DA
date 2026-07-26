'use client';

import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import { addDays, toDay } from './dates';
import { createGateway, type Gateway } from './gateway';
import { reconcilePlacement } from './rules/bookings';
import { correctEod as buildCorrection, type EodDraft } from './rules/eod';
import { endPlacement } from './rules/lifecycle';
import { deliver, EVENT_SEVERITY } from './rules/notifications';
import { computeStatement, lockStatement } from './rules/pay';
import { createSeedData } from './seed';
import type {
  Actor,
  Booking,
  CaseFileConfig,
  EscalationCategory,
  NotificationSeverity,
  OpsData,
  Placement,
} from './types';

/**
 * Session store. Actions run the same rule functions the tests cover, so the
 * prototype behaves like the spec rather than merely looking like it.
 *
 * State lives in memory for the length of the session. Swapping this for a real
 * database means replacing the reducer with mutations behind the same action
 * names; `gateway.ts` is already the read seam.
 */

const ADMIN: Actor = { role: 'admin', id: 'admin-da', name: 'DA Admin' };

type Action =
  | { type: 'set-actor'; actor: Actor }
  | { type: 'set-active-placement'; placementId: string }
  | { type: 'submit-eod'; draft: EodDraft }
  | { type: 'correct-eod'; reportId: string; draft: EodDraft; reason: string }
  | { type: 'comment-eod'; reportId: string; body: string }
  | { type: 'log-booking'; input: LogBookingInput }
  | { type: 'review-claim'; bookingId: string; decision: 'approve' | 'reject'; reason: string }
  | { type: 'raise-escalation'; input: RaiseEscalationInput }
  | { type: 'answer-escalation'; escalationId: string; answer: string }
  | { type: 'close-escalation'; escalationId: string }
  | { type: 'send-message'; operatorId: string; severity: NotificationSeverity; title: string; body: string }
  | { type: 'read-notification'; notificationId: string }
  | { type: 'complete-task'; taskId: string }
  | { type: 'add-adjustment'; statementId: string; label: string; reason: string; amount: number }
  | { type: 'close-period'; periodId: string }
  | { type: 'end-placement'; placementId: string }
  | { type: 'update-config'; clientId: string; config: CaseFileConfig }
  | { type: 'reset' };

export type LogBookingInput = {
  placementId: string;
  customerName: string;
  customerPhone: string;
  scheduledFor: string;
  operatorNote: string;
};

export type RaiseEscalationInput = {
  placementId: string;
  category: EscalationCategory;
  customerContext: string;
  needed: string;
};

let sequence = 0;
const nextId = (prefix: string) => {
  sequence += 1;
  return `${prefix}-${sequence}`;
};

/**
 * Open statements are recomputed after anything that moves the numbers. Locked
 * statements are passed through untouched — rule 6.
 */
function recomputeOpenStatements(data: OpsData): OpsData {
  const payStatements = data.payStatements.map((statement) => {
    if (statement.locked) return statement;

    const operator = data.operators.find((candidate) => candidate.id === statement.operatorId);
    const placement = data.placements.find((candidate) => candidate.id === statement.placementId);
    const period = data.payPeriods.find((candidate) => candidate.id === statement.periodId);
    if (!operator || !placement || !period) return statement;

    return computeStatement({
      operator,
      placement,
      period,
      bookingsForPlacement: data.bookings.filter((booking) => booking.placementId === placement.id),
      responseDays: data.responseDays,
      adjustments: statement.adjustments,
      existing: statement,
    });
  });

  return { ...data, payStatements };
}

/** Re-runs reconciliation for one placement, leaving other placements alone. */
function reconcile(data: OpsData, placementId: string): OpsData {
  const forPlacement = data.bookings.filter((booking) => booking.placementId === placementId);
  const others = data.bookings.filter((booking) => booking.placementId !== placementId);
  return { ...data, bookings: [...others, ...reconcilePlacement(forPlacement)] };
}

/**
 * Stand-in transport. A real deployment swaps this for the Discord, email and
 * WhatsApp clients; the attempt log it produces is the same either way.
 */
const demoTransport = () => ({ ok: true });

function notify(
  data: OpsData,
  operatorId: string,
  severity: NotificationSeverity,
  title: string,
  body: string,
  sentBy: string,
  placementId: string | null,
): OpsData {
  const operator = data.operators.find((candidate) => candidate.id === operatorId);
  if (!operator) return data;

  return {
    ...data,
    notifications: [
      {
        id: nextId('ntf'),
        operatorId,
        severity,
        title,
        body,
        createdAt: data.now,
        readAt: null,
        sentBy,
        relatedPlacementId: placementId,
        attempts: deliver({ severity, title, body }, operator, demoTransport, data.now),
      },
      ...data.notifications,
    ],
  };
}

function reducer(state: State, action: Action): State {
  const { data } = state;

  switch (action.type) {
    case 'set-actor':
      return { ...state, actor: action.actor, activePlacementId: null };

    // Which placement the operator is working in. Everything they log attaches
    // to this one.
    case 'set-active-placement':
      return { ...state, activePlacementId: action.placementId };

    case 'submit-eod': {
      const placement = data.placements.find((item) => item.id === action.draft.placementId);
      if (!placement) return state;
      return {
        ...state,
        data: {
          ...data,
          eodReports: [
            ...data.eodReports,
            {
              id: nextId('eod'),
              placementId: action.draft.placementId,
              operatorId: action.draft.operatorId,
              shiftDate: action.draft.shiftDate,
              submittedAt: data.now,
              core: action.draft.core,
              configured: action.draft.configured,
              version: 1,
              supersededById: null,
              correctionReason: null,
              adminComments: [],
            },
          ],
        },
      };
    }

    // Rule 2: the original is never edited, only superseded.
    case 'correct-eod': {
      const original = data.eodReports.find((report) => report.id === action.reportId);
      if (!original) return state;
      const { superseded, correction } = buildCorrection(original, action.draft, action.reason, data.now);
      return {
        ...state,
        data: {
          ...data,
          eodReports: [
            ...data.eodReports.map((report) => (report.id === original.id ? superseded : report)),
            correction,
          ],
        },
      };
    }

    case 'comment-eod': {
      const report = data.eodReports.find((candidate) => candidate.id === action.reportId);
      if (!report) return state;
      const withComment = {
        ...data,
        eodReports: data.eodReports.map((candidate) =>
          candidate.id === action.reportId
            ? {
                ...candidate,
                adminComments: [
                  ...candidate.adminComments,
                  { id: nextId('cmt'), authorName: ADMIN.name, body: action.body, createdAt: data.now },
                ],
              }
            : candidate,
        ),
      };
      return {
        ...state,
        data: notify(
          withComment,
          report.operatorId,
          EVENT_SEVERITY.eodComment,
          `Comment on your ${report.shiftDate} EOD`,
          action.body,
          ADMIN.name,
          report.placementId,
        ),
      };
    }

    case 'log-booking': {
      const placement = data.placements.find((item) => item.id === action.input.placementId);
      if (!placement) return state;

      const booking: Booking = {
        id: nextId('bk'),
        placementId: placement.id,
        operatorId: placement.operatorId,
        clientId: placement.clientId,
        scheduledFor: action.input.scheduledFor,
        recordedAt: data.now,
        source: 'manual',
        state: 'pending-review',
        customerName: action.input.customerName,
        customerPhone: action.input.customerPhone || null,
        customerEmail: null,
        matchedBookingId: null,
        operatorNote: action.input.operatorNote || null,
        reviewedBy: null,
        reviewedAt: null,
        rejectionReason: null,
        qualified: true,
      };

      // Reconciliation decides whether this lands confirmed or pending.
      const withBooking = reconcile({ ...data, bookings: [...data.bookings, booking] }, placement.id);
      return { ...state, data: recomputeOpenStatements(withBooking) };
    }

    case 'review-claim': {
      const claim = data.bookings.find((booking) => booking.id === action.bookingId);
      if (!claim) return state;
      const approved = action.decision === 'approve';

      const reviewed = {
        ...data,
        bookings: data.bookings.map((booking) =>
          booking.id === action.bookingId
            ? {
                ...booking,
                state: approved ? ('confirmed' as const) : ('rejected' as const),
                reviewedBy: ADMIN.name,
                reviewedAt: data.now,
                rejectionReason: approved ? null : action.reason,
                qualified: approved,
              }
            : booking,
        ),
      };

      const notified = notify(
        reviewed,
        claim.operatorId,
        approved ? EVENT_SEVERITY.bookingApproved : EVENT_SEVERITY.bookingRejected,
        approved ? 'Booking claim approved' : 'Booking claim rejected',
        approved
          ? `Your claim for ${claim.customerName} was approved and now counts toward quota and commission.`
          : `Your claim for ${claim.customerName} was rejected. ${action.reason}`,
        ADMIN.name,
        claim.placementId,
      );

      return { ...state, data: recomputeOpenStatements(notified) };
    }

    case 'raise-escalation': {
      const placement = data.placements.find((item) => item.id === action.input.placementId);
      if (!placement) return state;
      const client = data.clients.find((candidate) => candidate.id === placement.clientId);
      const windowHours = client?.config.escalationResponseHours ?? 4;
      const contact = client?.config.escalationContact;

      return {
        ...state,
        data: {
          ...data,
          escalations: [
            {
              id: nextId('esc'),
              placementId: placement.id,
              operatorId: placement.operatorId,
              clientId: placement.clientId,
              category: action.input.category,
              customerContext: action.input.customerContext,
              needed: action.input.needed,
              status: 'open',
              raisedAt: data.now,
              responseDueAt: new Date(Date.parse(data.now) + windowHours * 3600000).toISOString(),
              answeredAt: null,
              answer: null,
              answeredBy: null,
              closedAt: null,
              routedTo: [ADMIN.name, ...(contact ? [contact.name] : [])],
            },
            ...data.escalations,
          ],
        },
      };
    }

    case 'answer-escalation': {
      const escalation = data.escalations.find((candidate) => candidate.id === action.escalationId);
      if (!escalation) return state;
      const answered = {
        ...data,
        escalations: data.escalations.map((candidate) =>
          candidate.id === action.escalationId
            ? {
                ...candidate,
                status: 'answered' as const,
                answeredAt: data.now,
                answer: action.answer,
                answeredBy: ADMIN.name,
              }
            : candidate,
        ),
      };
      return {
        ...state,
        data: notify(
          answered,
          escalation.operatorId,
          'important',
          'Your escalation was answered',
          action.answer,
          ADMIN.name,
          escalation.placementId,
        ),
      };
    }

    case 'close-escalation':
      return {
        ...state,
        data: {
          ...data,
          escalations: data.escalations.map((candidate) =>
            candidate.id === action.escalationId
              ? { ...candidate, status: 'closed' as const, closedAt: data.now }
              : candidate,
          ),
        },
      };

    case 'send-message':
      return {
        ...state,
        data: notify(
          data,
          action.operatorId,
          action.severity,
          action.title,
          action.body,
          ADMIN.name,
          null,
        ),
      };

    case 'read-notification':
      return {
        ...state,
        data: {
          ...data,
          notifications: data.notifications.map((notification) =>
            notification.id === action.notificationId && !notification.readAt
              ? { ...notification, readAt: data.now }
              : notification,
          ),
        },
      };

    case 'complete-task':
      return {
        ...state,
        data: {
          ...data,
          tasks: data.tasks.map((task) =>
            task.id === action.taskId ? { ...task, completedOn: toDay(data.now) } : task,
          ),
        },
      };

    case 'add-adjustment': {
      const target = data.payStatements.find((statement) => statement.id === action.statementId);
      if (!target || target.locked) return state;

      const withAdjustment = {
        ...data,
        payStatements: data.payStatements.map((statement) =>
          statement.id === action.statementId
            ? {
                ...statement,
                adjustments: [
                  ...statement.adjustments,
                  {
                    id: nextId('adj'),
                    statementId: statement.id,
                    label: action.label,
                    reason: action.reason,
                    amount: action.amount,
                    addedBy: ADMIN.name,
                    addedAt: data.now,
                  },
                ],
              }
            : statement,
        ),
      };
      return { ...state, data: recomputeOpenStatements(withAdjustment) };
    }

    // Closing a period freezes its statements. Rule 6.
    case 'close-period': {
      const period = data.payPeriods.find((candidate) => candidate.id === action.periodId);
      if (!period || period.status === 'closed') return state;
      return {
        ...state,
        data: {
          ...data,
          payPeriods: data.payPeriods.map((candidate) =>
            candidate.id === action.periodId
              ? { ...candidate, status: 'closed' as const, closedAt: data.now }
              : candidate,
          ),
          payStatements: data.payStatements.map((statement) =>
            statement.periodId === action.periodId ? lockStatement(statement, data.now) : statement,
          ),
        },
      };
    }

    case 'end-placement': {
      const placement = data.placements.find((candidate) => candidate.id === action.placementId);
      const operator = data.operators.find((candidate) => candidate.id === placement?.operatorId);
      if (!placement || !operator) return state;

      const result = endPlacement(placement, operator, data.now);
      const ended = {
        ...data,
        placements: data.placements.map((candidate) =>
          candidate.id === placement.id ? result.placement : candidate,
        ),
        operators: data.operators.map((candidate) =>
          candidate.id === operator.id ? result.operator : candidate,
        ),
      };

      return {
        ...state,
        data: notify(
          ended,
          operator.id,
          'important',
          'Placement ended',
          `Your placement on ${data.clients.find((c) => c.id === placement.clientId)?.name ?? 'the client'} closed today. You are on the bench and available for re-placement.`,
          ADMIN.name,
          placement.id,
        ),
      };
    }

    case 'update-config':
      return {
        ...state,
        data: {
          ...data,
          clients: data.clients.map((client) =>
            client.id === action.clientId ? { ...client, config: action.config } : client,
          ),
        },
      };

    case 'reset':
      return { actor: state.actor, activePlacementId: state.activePlacementId, data: createSeedData() };

    default:
      return state;
  }
}

type State = { actor: Actor; activePlacementId: string | null; data: OpsData };

type StoreValue = {
  gateway: Gateway;
  actor: Actor;
  data: OpsData;
  admin: Actor;
  /** The placement an operator is currently working in. Null for the admin. */
  activePlacement: Placement | null;
  myLivePlacements: Placement[];
  setActivePlacement: (placementId: string) => void;
  setActor: (actor: Actor) => void;
  submitEod: (draft: EodDraft) => void;
  correctEod: (reportId: string, draft: EodDraft, reason: string) => void;
  commentOnEod: (reportId: string, body: string) => void;
  logBooking: (input: LogBookingInput) => void;
  reviewClaim: (bookingId: string, decision: 'approve' | 'reject', reason: string) => void;
  raiseEscalation: (input: RaiseEscalationInput) => void;
  answerEscalation: (escalationId: string, answer: string) => void;
  closeEscalation: (escalationId: string) => void;
  sendMessage: (operatorId: string, severity: NotificationSeverity, title: string, body: string) => void;
  readNotification: (notificationId: string) => void;
  completeTask: (taskId: string) => void;
  addAdjustment: (statementId: string, label: string, reason: string, amount: number) => void;
  closePeriod: (periodId: string) => void;
  endPlacementNow: (placementId: string) => void;
  updateConfig: (clientId: string, config: CaseFileConfig) => void;
  reset: () => void;
};

const StoreContext = createContext<StoreValue | null>(null);

const ACTOR_STORAGE_KEY = 'vistrial.actor';

export function OpsProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    actor: ADMIN,
    activePlacementId: null,
    data: createSeedData(),
  }));

  /**
   * Records are in memory for the session, but who you signed in as survives a
   * reload so that deep links and refreshes do not silently drop you back to
   * the admin view. Restored after mount to keep hydration honest.
   */
  useEffect(() => {
    const stored = window.localStorage.getItem(ACTOR_STORAGE_KEY);
    if (!stored) return;
    if (stored === ADMIN.id) return;
    const operator = state.data.operators.find((candidate) => candidate.id === stored);
    if (operator) {
      dispatch({ type: 'set-actor', actor: { role: 'operator', id: operator.id, name: operator.name } });
    }
    // Runs once: this restores a prior session, it does not track later changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    window.localStorage.setItem(ACTOR_STORAGE_KEY, state.actor.id);
  }, [state.actor.id]);

  const gateway = useMemo(() => createGateway(state.data, state.actor), [state.data, state.actor]);

  const myLivePlacements = useMemo(
    () => (state.actor.role === 'operator' ? gateway.myPlacements() : []),
    [gateway, state.actor.role],
  );

  const activePlacement =
    myLivePlacements.find((placement) => placement.id === state.activePlacementId) ??
    myLivePlacements[0] ??
    null;

  const value = useMemo<StoreValue>(
    () => ({
      gateway,
      actor: state.actor,
      data: state.data,
      admin: ADMIN,
      activePlacement,
      myLivePlacements,
      setActivePlacement: (placementId) => dispatch({ type: 'set-active-placement', placementId }),
      setActor: (actor) => dispatch({ type: 'set-actor', actor }),
      submitEod: (draft) => dispatch({ type: 'submit-eod', draft }),
      correctEod: (reportId, draft, reason) => dispatch({ type: 'correct-eod', reportId, draft, reason }),
      commentOnEod: (reportId, body) => dispatch({ type: 'comment-eod', reportId, body }),
      logBooking: (input) => dispatch({ type: 'log-booking', input }),
      reviewClaim: (bookingId, decision, reason) =>
        dispatch({ type: 'review-claim', bookingId, decision, reason }),
      raiseEscalation: (input) => dispatch({ type: 'raise-escalation', input }),
      answerEscalation: (escalationId, answer) =>
        dispatch({ type: 'answer-escalation', escalationId, answer }),
      closeEscalation: (escalationId) => dispatch({ type: 'close-escalation', escalationId }),
      sendMessage: (operatorId, severity, title, body) =>
        dispatch({ type: 'send-message', operatorId, severity, title, body }),
      readNotification: (notificationId) => dispatch({ type: 'read-notification', notificationId }),
      completeTask: (taskId) => dispatch({ type: 'complete-task', taskId }),
      addAdjustment: (statementId, label, reason, amount) =>
        dispatch({ type: 'add-adjustment', statementId, label, reason, amount }),
      closePeriod: (periodId) => dispatch({ type: 'close-period', periodId }),
      endPlacementNow: (placementId) => dispatch({ type: 'end-placement', placementId }),
      updateConfig: (clientId, config) => dispatch({ type: 'update-config', clientId, config }),
      reset: () => dispatch({ type: 'reset' }),
    }),
    [gateway, state.actor, state.data, activePlacement, myLivePlacements],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useOps(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useOps must be used inside <OpsProvider>');
  return value;
}

/** Today's shift date for an operator, used to prefill and locate EODs. */
export const shiftDateFor = (now: string) => toDay(now);
export const previousShiftDate = (now: string) => addDays(toDay(now), -1);
