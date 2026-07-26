import {
  assertAdmin,
  assertCanReadOperator,
  assertCanReadPlacement,
  isAdmin,
  scopeByOperator,
  scopeByPlacement,
  visiblePlacements,
} from './access';
import { monthKey, toDay } from './dates';
import { commissionableBookings, pendingBookings, summarise } from './rules/bookings';
import { currentVersions, versionChain } from './rules/eod';
import { buildExceptionQueue } from './rules/exceptions';
import { isPlacementLive, placementStatus } from './rules/lifecycle';
import { placementMetrics } from './rules/metrics';
import type {
  Actor,
  Booking,
  Client,
  EodReport,
  Escalation,
  Exception,
  Notification,
  Operator,
  OperatorTask,
  OpsData,
  PayStatement,
  Placement,
  PlacementMetrics,
} from './types';

/**
 * The read API. Every selector takes the actor and narrows before returning, so
 * a component cannot reach another operator's records even by accident. This is
 * where rule 1 is enforced; the UI just renders what it is handed.
 */
export type Gateway = ReturnType<typeof createGateway>;

export function createGateway(data: OpsData, actor: Actor) {
  const placements = () => visiblePlacements(actor, data);

  const placement = (id: string): Placement | undefined => {
    assertCanReadPlacement(actor, id, data);
    return data.placements.find((candidate) => candidate.id === id);
  };

  const bookings = (): Booking[] => scopeByPlacement(actor, data.bookings, data);
  const reports = (): EodReport[] => scopeByPlacement(actor, data.eodReports, data);
  const escalations = (): Escalation[] => scopeByPlacement(actor, data.escalations, data);

  const bookingsFor = (placementId: string): Booking[] => {
    assertCanReadPlacement(actor, placementId, data);
    return data.bookings.filter((booking) => booking.placementId === placementId);
  };

  const metricsFor = (placementId: string): PlacementMetrics => {
    assertCanReadPlacement(actor, placementId, data);
    const target = data.placements.find((candidate) => candidate.id === placementId)!;
    return placementMetrics({
      placement: target,
      bookings: data.bookings,
      reports: data.eodReports,
      escalations: data.escalations,
      responseDays: data.responseDays,
      now: data.now,
    });
  };

  return {
    now: data.now,
    today: toDay(data.now),
    actor,
    isAdmin: isAdmin(actor),

    // ---- shared ---------------------------------------------------------
    placements,
    placement,
    livePlacements: () => placements().filter(isPlacementLive),
    statusOf: (target: Placement) => placementStatus(target, data.now),
    client: (id: string): Client | undefined => data.clients.find((candidate) => candidate.id === id),
    clientName: (id: string) => data.clients.find((candidate) => candidate.id === id)?.name ?? 'Unknown client',
    operator: (id: string): Operator | undefined => {
      assertCanReadOperator(actor, id);
      return data.operators.find((candidate) => candidate.id === id);
    },
    operatorName: (id: string) => data.operators.find((candidate) => candidate.id === id)?.name ?? 'Unknown operator',

    bookings,
    bookingsFor,
    reports,
    reportsFor: (placementId: string) => {
      assertCanReadPlacement(actor, placementId, data);
      return data.eodReports.filter((report) => report.placementId === placementId);
    },
    currentReportsFor: (placementId: string) => {
      assertCanReadPlacement(actor, placementId, data);
      return currentVersions(data.eodReports.filter((report) => report.placementId === placementId));
    },
    reportVersions: (placementId: string, shiftDate: string) => {
      assertCanReadPlacement(actor, placementId, data);
      return versionChain(data.eodReports, shiftDate, placementId);
    },
    escalations,
    escalationsFor: (placementId: string) => {
      assertCanReadPlacement(actor, placementId, data);
      return data.escalations.filter((escalation) => escalation.placementId === placementId);
    },
    metricsFor,
    reconciliationFor: (placementId: string) => summarise(bookingsFor(placementId)),
    pendingFor: (placementId: string) => pendingBookings(bookingsFor(placementId)),
    confirmedFor: (placementId: string) => commissionableBookings(bookingsFor(placementId)),

    tasksFor: (operatorId: string): OperatorTask[] => {
      assertCanReadOperator(actor, operatorId);
      return data.tasks.filter((task) => task.operatorId === operatorId);
    },
    notificationsFor: (operatorId: string): Notification[] => {
      assertCanReadOperator(actor, operatorId);
      return data.notifications
        .filter((notification) => notification.operatorId === operatorId)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    },

    payPeriods: () => [...data.payPeriods].sort((a, b) => Date.parse(b.start) - Date.parse(a.start)),
    payPeriod: (id: string) => data.payPeriods.find((period) => period.id === id),
    statements: (): PayStatement[] => scopeByOperator(actor, data.payStatements),
    statementsFor: (operatorId: string): PayStatement[] => {
      assertCanReadOperator(actor, operatorId);
      return data.payStatements.filter((statement) => statement.operatorId === operatorId);
    },
    statement: (id: string): PayStatement | undefined => {
      const found = data.payStatements.find((candidate) => candidate.id === id);
      if (found) assertCanReadOperator(actor, found.operatorId);
      return found;
    },
    bookingsByIds: (ids: string[]) => {
      const wanted = new Set(ids);
      return scopeByPlacement(actor, data.bookings, data).filter((booking) => wanted.has(booking.id));
    },

    // ---- operator -------------------------------------------------------
    myPlacements: () => placements().filter(isPlacementLive),
    myHistory: () => placements().filter((target) => !isPlacementLive(target)),

    // ---- admin only -----------------------------------------------------
    allOperators: (): Operator[] => {
      assertAdmin(actor, 'the operator roster');
      return data.operators;
    },
    bench: (): Operator[] => {
      assertAdmin(actor, 'the bench');
      return data.operators.filter((operator) => operator.status === 'on-bench');
    },
    allClients: (): Client[] => {
      assertAdmin(actor, 'the client list');
      return data.clients;
    },
    exceptions: (): Exception[] => {
      assertAdmin(actor, 'the exception queue');
      return buildExceptionQueue({
        operators: data.operators,
        clients: data.clients,
        placements: data.placements,
        bookings: data.bookings,
        eodReports: data.eodReports,
        escalations: data.escalations,
        responseDays: data.responseDays,
        now: data.now,
      });
    },
    reviewQueue: (): Booking[] => {
      assertAdmin(actor, 'the booking review queue');
      return pendingBookings(data.bookings).sort(
        (a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt),
      );
    },
    allEscalations: (): Escalation[] => {
      assertAdmin(actor, 'all escalations');
      return [...data.escalations].sort((a, b) => Date.parse(b.raisedAt) - Date.parse(a.raisedAt));
    },
    allNotifications: (): Notification[] => {
      assertAdmin(actor, 'the notification log');
      return [...data.notifications].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    },
    scopeRequestsFor: (clientId: string) =>
      data.scopeRequests.filter((request) => request.clientId === clientId),
    adminNotesFor: (clientId: string) => {
      assertAdmin(actor, 'admin notes');
      return data.adminNotes.filter((note) => note.clientId === clientId);
    },
    evidenceFor: (clientId: string) => data.evidence.filter((item) => item.clientId === clientId),
    placementsForClient: (clientId: string) => {
      const all = data.placements.filter((target) => target.clientId === clientId);
      return isAdmin(actor) ? all : all.filter((target) => target.operatorId === actor.id);
    },
    placementsForOperator: (operatorId: string) => {
      assertCanReadOperator(actor, operatorId);
      return data.placements.filter((target) => target.operatorId === operatorId);
    },
    monthOf: (value: string) => monthKey(toDay(value)),
  };
}
