'use client';

import { useRouter } from 'next/navigation';
import { createContext, useContext, useMemo, useState } from 'react';
import { addDays, toDay } from './dates';
import { createGateway, type Gateway } from './gateway';
import type { EodDraft } from './rules/eod';
import {
  addPayAdjustmentAction,
  answerEscalationAction,
  closeEscalationAction,
  closePayPeriodAction,
  commentOnEodAction,
  completeTaskAction,
  correctEodAction,
  endPlacementAction,
  logBookingAction,
  markNotificationReadAction,
  raiseEscalationAction,
  reviewClaimAction,
  sendNotificationAction,
  submitEodAction,
  type HubResult,
} from './serverActions';
import type { Actor, EscalationCategory, NotificationSeverity, OpsData, Placement } from './types';

/**
 * The hub reads from Postgres. Data arrives from the server on every render, and
 * every mutation is a server action followed by a refresh, so there is one source
 * of truth and nothing here holds fixtures.
 */

export type LogBookingInput = {
  placementId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  scheduledFor: string;
  operatorNote: string;
};

export type RaiseEscalationInput = {
  placementId: string;
  category: EscalationCategory;
  customerContext: string;
  needed: string;
};

type StoreValue = {
  gateway: Gateway;
  actor: Actor;
  data: OpsData;
  /** The placement an operator is currently working in. Null for the admin. */
  activePlacement: Placement | null;
  myLivePlacements: Placement[];
  setActivePlacement: (placementId: string) => void;
  /** The most recent action outcome, so surfaces can report what happened. */
  lastResult: HubResult | null;
  submitEod: (draft: EodDraft) => Promise<HubResult>;
  correctEod: (reportId: string, draft: EodDraft, reason: string) => Promise<HubResult>;
  commentOnEod: (reportId: string, body: string) => Promise<HubResult>;
  logBooking: (input: LogBookingInput) => Promise<HubResult>;
  reviewClaim: (bookingId: string, decision: 'approve' | 'reject', reason: string) => Promise<HubResult>;
  raiseEscalation: (input: RaiseEscalationInput) => Promise<HubResult>;
  answerEscalation: (escalationId: string, answer: string) => Promise<HubResult>;
  closeEscalation: (escalationId: string) => Promise<HubResult>;
  sendMessage: (
    operatorId: string,
    severity: NotificationSeverity,
    title: string,
    body: string,
  ) => Promise<HubResult>;
  readNotification: (notificationId: string) => Promise<HubResult>;
  completeTask: (taskId: string) => Promise<HubResult>;
  addAdjustment: (statementId: string, label: string, reason: string, amount: number) => Promise<HubResult>;
  closePeriod: (periodId: string) => Promise<HubResult>;
  endPlacementNow: (placementId: string) => Promise<HubResult>;
};

const StoreContext = createContext<StoreValue | null>(null);

export function OpsProvider({
  data,
  actor,
  children,
}: {
  data: OpsData;
  actor: Actor;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [activePlacementId, setActivePlacementId] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<HubResult | null>(null);

  const gateway = useMemo(() => createGateway(data, actor), [data, actor]);

  const myLivePlacements = useMemo(
    () => (actor.role === 'operator' ? gateway.myPlacements() : []),
    [gateway, actor.role],
  );

  const activePlacement =
    myLivePlacements.find((placement) => placement.id === activePlacementId) ?? myLivePlacements[0] ?? null;

  const value = useMemo<StoreValue>(() => {
    // Every mutation goes to the server, then the router refetches, so the UI
    // never diverges from what was actually written.
    const run = async (action: () => Promise<HubResult>): Promise<HubResult> => {
      const result = await action();
      setLastResult(result);
      if (result.ok) router.refresh();
      return result;
    };

    return {
      gateway,
      actor,
      data,
      activePlacement,
      myLivePlacements,
      lastResult,
      setActivePlacement: setActivePlacementId,

      submitEod: (draft) =>
        run(() =>
          submitEodAction({
            placementId: draft.placementId,
            operatorId: draft.operatorId,
            shiftDate: draft.shiftDate,
            core: draft.core,
            configured: draft.configured,
          }),
        ),
      correctEod: (reportId, draft, reason) => run(() => correctEodAction(reportId, draft.core, reason)),
      commentOnEod: (reportId, body) => run(() => commentOnEodAction(reportId, body)),
      logBooking: (input) => run(() => logBookingAction(input)),
      reviewClaim: (bookingId, decision, reason) => run(() => reviewClaimAction(bookingId, decision, reason)),
      raiseEscalation: (input) => run(() => raiseEscalationAction(input)),
      answerEscalation: (escalationId, answer) => run(() => answerEscalationAction(escalationId, answer)),
      closeEscalation: (escalationId) => run(() => closeEscalationAction(escalationId)),
      sendMessage: (operatorId, severity, title, body) =>
        run(() => sendNotificationAction({ operatorId, severity, title, body })),
      readNotification: (notificationId) => run(() => markNotificationReadAction(notificationId)),
      completeTask: (taskId) => run(() => completeTaskAction(taskId)),
      addAdjustment: (statementId, label, reason, amount) =>
        run(() => addPayAdjustmentAction(statementId, label, reason, amount)),
      closePeriod: (periodId) => run(() => closePayPeriodAction(periodId)),
      endPlacementNow: (placementId) => run(() => endPlacementAction(placementId)),
    };
  }, [gateway, actor, data, activePlacement, myLivePlacements, lastResult, router]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useOps(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useOps must be used inside <OpsProvider>');
  return value;
}

export const shiftDateFor = (now: string) => toDay(now);
export const previousShiftDate = (now: string) => addDays(toDay(now), -1);
