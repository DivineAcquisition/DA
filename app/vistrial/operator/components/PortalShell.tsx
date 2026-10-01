'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import Backdrop from '@/app/components/Backdrop';
import Logo from '@/app/components/Logo';
import { Surface } from '@/components/ui/surface';
import { btnPrimary, btnSecondary, btnSizeSm } from '@/app/components/ui';
import { acknowledgeNoticeAction, selectPlacementAction } from '@/lib/portal/actions';
import { SEVERITY_LABEL, SEVERITY_TONE } from '@/lib/portal/labels';
import { exitViewAsAction, extendViewAsAction } from '@/lib/portal/staffActions';
import { formatDuration } from '@/lib/portal/time';
import type { PortalContext } from '@/lib/portal/types';
import { menuFor, zoneOf, zonesFor, type NavItem, type TabKey } from '@/lib/portal/zones';
import { hubSignOutAction } from '@/lib/vistrial/authActions';
import { Badge } from '../../components/ui';
import AdminPanel from './AdminPanel';
import { Feedback, PortalProvider, Sheet, useAction } from './portal';

export type { TabKey };

function badgeFor(key: string, context: PortalContext): number {
  const b = context.badges;
  switch (key) {
    case 'record':
      return (b.reviews_open ?? 0) + b.answers_ready;
    case 'growth':
      return (b.feedback_unread ?? 0) + b.pay_answers;
    case 'pay':
      return b.pay_answers;
    case 'tasks':
      return b.open_tasks;
    case 'inbox':
      return b.unread_notifications;
    default:
      return 0;
  }
}

export default function PortalShell({
  context,
  placementId,
  tab,
  blocked,
  children,
}: {
  context: PortalContext;
  placementId: string | null;
  tab: TabKey;
  blocked: boolean;
  children: React.ReactNode;
}) {
  const viewAs = context.viewer.view_as;
  const [panelOpen, setPanelOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [peek, setPeek] = useState(false);

  const showGate = context.blocking_notices.length > 0 && (blocked || (viewAs && !peek));
  const zones = zonesFor(context);
  const menu = menuFor(context);
  const zone = zoneOf(tab);
  const menuCount = menu.reduce((sum, item) => sum + badgeFor(item.key, context), 0);

  return (
    <PortalProvider context={context} placementId={placementId}>
      <div className={`relative min-h-screen bg-ink-950 text-white antialiased ${viewAs ? 'pt-[52px]' : ''}`}>
        <Backdrop />
        <div className="relative z-10">
        {viewAs ? <ViewAsBanner context={context} onPanel={() => setPanelOpen(true)} /> : null}

        {showGate ? (
          <BlockingNotices context={context} onPeek={viewAs ? () => setPeek(true) : undefined} />
        ) : (
          <>
            <header className={`sticky z-40 border-b border-white/[0.06] bg-ink-950/90 backdrop-blur-xl ${viewAs ? 'top-[52px]' : 'top-0'}`}>
              <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
                <Link href={zones[0]?.href ?? '/vistrial/operator'} className="flex min-w-0 items-center gap-2">
                  <Logo markOnly className="h-5 w-auto shrink-0" />
                  <span className="truncate text-sm font-semibold">{context.operator.name}</span>
                </Link>
                <div className="flex items-center gap-2">
                  <PlacementSwitcher context={context} placementId={placementId} />
                  <button
                    type="button"
                    onClick={() => setMoreOpen(true)}
                    aria-label="Menu"
                    className={`${btnSecondary} relative px-3 py-1.5 text-xs`}
                  >
                    Menu
                    {menuCount > 0 ? (
                      <span className="absolute -right-1 -top-1 rounded-full bg-brand-500 px-1.5 text-[10px] font-bold text-ink-950">
                        {menuCount}
                      </span>
                    ) : null}
                  </button>
                </div>
              </div>
              <nav className="mx-auto hidden max-w-5xl gap-1 overflow-x-auto px-3 pb-2 md:flex" aria-label="Zones">
                {zones.map((item) => {
                  const count = badgeFor(item.key, context);
                  const current = item.key === zone;
                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      aria-current={current ? 'page' : undefined}
                      className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                        current
                          ? 'bg-brand-500/[0.14] text-brand-100 ring-1 ring-inset ring-brand-500/25'
                          : 'text-neutral-400 hover:bg-white/[0.04] hover:text-white'
                      }`}
                    >
                      {item.label}
                      {count > 0 ? (
                        <span className="rounded-full bg-brand-500 px-1.5 text-[10px] font-bold text-ink-950">{count}</span>
                      ) : null}
                    </Link>
                  );
                })}
              </nav>
            </header>

            <main className="mx-auto max-w-5xl px-4 pb-28 pt-5 md:pb-12">{children}</main>

            <MobileBar zones={zones} zone={zone} context={context} />
            <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="Menu">
              <div className="grid gap-2">
                {menu.map((item) => {
                  const count = badgeFor(item.key, context);
                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm ${
                        item.key === tab ? 'bg-brand-500/[0.14] text-brand-100' : 'bg-white/[0.03] text-neutral-200'
                      }`}
                    >
                      {item.label}
                      {count > 0 ? <span className="rounded-full bg-brand-500 px-2 text-[11px] font-bold text-ink-950">{count}</span> : null}
                    </Link>
                  );
                })}
                {viewAs ? null : (
                  <form action={hubSignOutAction}>
                    <button type="submit" className="w-full rounded-xl bg-white/[0.03] px-4 py-3 text-left text-sm text-neutral-400">
                      Sign out
                    </button>
                  </form>
                )}
              </div>
            </Sheet>
          </>
        )}

        {viewAs ? <AdminPanel context={context} open={panelOpen} onClose={() => setPanelOpen(false)} /> : null}
        </div>
      </div>
    </PortalProvider>
  );
}

function MobileBar({ zones, zone, context }: { zones: NavItem[]; zone: string | null; context: PortalContext }) {
  if (zones.length < 2) return null;
  return (
    <nav
      aria-label="Zones"
      className="fixed inset-x-0 bottom-0 z-40 grid border-t border-white/[0.08] bg-ink-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      style={{ gridTemplateColumns: `repeat(${zones.length}, minmax(0, 1fr))` }}
    >
      {zones.map((item) => {
        const count = badgeFor(item.key, context);
        const current = item.key === zone;
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={current ? 'page' : undefined}
            className={`relative flex flex-col items-center gap-0.5 px-1 py-2.5 text-[11px] font-medium ${
              current ? 'text-brand-200' : 'text-neutral-500'
            }`}
          >
            <span className={`h-1 w-6 rounded-full ${current ? 'bg-brand-500' : 'bg-transparent'}`} />
            <span className="max-w-full truncate">{item.short}</span>
            {count > 0 ? (
              <span className="absolute right-2 top-1.5 rounded-full bg-brand-500 px-1.5 text-[10px] font-bold text-ink-950">{count}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

function PlacementSwitcher({ context, placementId }: { context: PortalContext; placementId: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  if (context.placements.length < 2) {
    const only = context.placements[0];
    return only ? <span className="hidden max-w-40 truncate text-xs text-neutral-500 sm:inline">{only.client_name}</span> : null;
  }
  return (
    <label className="flex items-center">
      <span className="sr-only">Placement</span>
      <select
        value={placementId ?? ''}
        disabled={pending}
        onChange={(event) => {
          const id = event.target.value;
          startTransition(async () => {
            await selectPlacementAction(id);
            router.refresh();
          });
        }}
        className="field-control max-w-44 cursor-pointer truncate rounded-full px-3 py-1.5 text-xs text-white"
      >
        {context.placements.map((placement) => (
          <option key={placement.id} value={placement.id}>
            {placement.client_name}
            {placement.live ? '' : ' (ended)'}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * The View As banner. Cyan appears nowhere else in the product, so there is never
 * a doubt about whose account is on screen. It stays on every tab, over
 * everything, including a blocking notice.
 */
function ViewAsBanner({ context, onPanel }: { context: PortalContext; onPanel: () => void }) {
  const router = useRouter();
  const viewer = context.viewer;
  const [now, setNow] = useState(() => Date.now());
  const [extendOpen, setExtendOpen] = useState(false);
  const [reason, setReason] = useState('');
  const extend = useAction();
  const [exiting, startExit] = useTransition();

  const returnTo =
    viewer.actor_role === 'manager' ? '/vistrial/team' : `/vistrial/admin/operators/${context.operator.id}`;
  const left = viewer.expires_at ? Date.parse(viewer.expires_at) - now : 0;

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // The session ended on the server at expiry; take the viewer back.
    if (viewer.expires_at && left <= 0) {
      router.replace(returnTo);
      router.refresh();
    }
  }, [left, viewer.expires_at, returnTo, router]);

  return (
    <>
      <div
        role="region"
        aria-label="View As"
        className="fixed inset-x-0 top-0 z-50 flex h-[52px] items-center gap-2 bg-cyan-400 px-3 text-cyan-950 shadow-lg sm:px-4"
      >
        <p className="min-w-0 flex-1 truncate text-[13px] font-semibold">
          Viewing as {context.operator.name} · Read-only · {formatDuration(left)} left
          {viewer.kind === 'impersonation' ? ' · Impersonation' : ''}
        </p>
        <button type="button" onClick={onPanel} className="rounded-full bg-cyan-950 px-3 py-1.5 text-xs font-semibold text-cyan-100">
          Admin panel
        </button>
        {viewer.kind === 'view_as' && !viewer.extended ? (
          <button
            type="button"
            onClick={() => setExtendOpen(true)}
            className="rounded-full border border-cyan-950/40 px-2.5 py-1.5 text-xs font-semibold sm:px-3"
          >
            <span className="sm:hidden">+30m</span>
            <span className="hidden sm:inline">Extend</span>
          </button>
        ) : null}
        <button
          type="button"
          disabled={exiting}
          onClick={() => startExit(() => exitViewAsAction(returnTo))}
          className="rounded-full border border-cyan-950 px-3 py-1.5 text-xs font-bold"
        >
          Exit
        </button>
      </div>
      <Sheet open={extendOpen} onClose={() => setExtendOpen(false)} title="Extend by 30 minutes">
        <p className="text-sm text-neutral-400">A session can be extended once. Say why you need more time; it goes on the record.</p>
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          className="field-control mt-3 w-full rounded-xl px-3.5 py-2.5 text-sm"
          placeholder="Still reviewing the disputed bookings from last week"
        />
        <button
          type="button"
          disabled={extend.pending || reason.trim().length < 5}
          onClick={() => extend.run(() => extendViewAsAction(reason), (r) => r.ok && setExtendOpen(false))}
          className={`${btnPrimary} ${btnSizeSm} mt-3`}
        >
          Extend
        </button>
        <Feedback message={extend.message} error={extend.error} />
      </Sheet>
    </>
  );
}

function BlockingNotices({ context, onPeek }: { context: PortalContext; onPeek?: () => void }) {
  const notice = context.blocking_notices[0];
  const action = useAction();
  const readOnly = context.viewer.read_only;
  return (
    <main className="mx-auto flex min-h-[80vh] max-w-xl flex-col justify-center px-4 py-10">
      <Surface beam className="rounded-3xl p-6">
        <div className="mb-4 flex items-center gap-2">
          <Badge tone={SEVERITY_TONE[notice.severity] ?? 'warning'}>{SEVERITY_LABEL[notice.severity] ?? 'Notice'}</Badge>
          {context.blocking_notices.length > 1 ? (
            <span className="text-xs text-neutral-500">1 of {context.blocking_notices.length}</span>
          ) : null}
        </div>
        <h1 className="text-lg font-semibold">Read this before you continue</h1>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-neutral-200">{notice.body}</p>
        <p className="mt-4 text-xs text-neutral-500">
          Confirming records the time you read it. Everything else in your portal opens once you do.
        </p>
        <button
          type="button"
          disabled={readOnly || action.pending}
          title={readOnly ? `Only ${context.operator.first_name} can confirm this.` : undefined}
          onClick={() => action.run(() => acknowledgeNoticeAction(notice.id))}
          className={`${btnPrimary} ${btnSizeSm} mt-5 w-full sm:w-auto ${readOnly ? 'cursor-not-allowed opacity-45' : ''}`}
        >
          I have read this
        </button>
        {readOnly ? (
          <p className="mt-2 text-[11px] text-cyan-300">
            Only {context.operator.first_name} can confirm this. They see this screen until they do.
          </p>
        ) : null}
        <Feedback error={action.error} />
        {onPeek ? (
          <button type="button" onClick={onPeek} className="mt-5 text-xs text-cyan-300 underline">
            Look at the portal behind the notice
          </button>
        ) : null}
      </Surface>
    </main>
  );
}
