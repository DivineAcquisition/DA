'use client';

import { useState, useTransition } from 'react';
import { buildGhlSetupAction } from '@/lib/acq/ghl-setup-actions';
import type { GhlSetupSummary } from '@/lib/acq/ghl-setup';
import { Badge, Button } from './ui';
import { ws } from './tokens';

export type GhlSetupRun = { ran_at: string; ok: boolean; summary: GhlSetupSummary };

function Lines({ title, items, tone = 'dim' }: { title: string; items: string[]; tone?: 'dim' | 'error' }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="text-xs font-medium text-neutral-300">{title}</p>
      <ul className={`mt-1 space-y-0.5 text-xs ${tone === 'error' ? 'text-[var(--ws-error)]' : 'text-[var(--ws-dim)]'}`}>
        {items.map((item) => (
          <li key={item} className="break-words font-mono">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function GhlSetupPanel({ lastRun }: { lastRun: GhlSetupRun | null }) {
  const [run, setRun] = useState<GhlSetupRun | null>(lastRun);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const summary = run?.summary;
  const failures = summary ? resultFailures(summary) : [];

  return (
    <section className={`${ws.card} space-y-4 p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className={`${ws.heading} text-base font-semibold`}>GoHighLevel</h2>
            {run && (run.ok ? <Badge tone="success">Built</Badge> : <Badge tone="error">Needs attention</Badge>)}
            {!run && <Badge tone="pending">Not built yet</Badge>}
          </div>
          <p className="mt-1.5 max-w-2xl text-sm text-[var(--ws-dim)]">
            Creates the formal tags (renaming the old ones), the DA - contact fields and the lead pipeline
            in the DivineACQ location, then puts every workspace lead in it with its stage, tags and
            opportunity. Safe to run again; it only adds what is missing.
          </p>
          {run && (
            <p className="mt-1 text-sm text-[var(--ws-dim)]">
              Last run {new Date(run.ran_at).toLocaleString()} · token from{' '}
              {summary?.token === 'env' ? 'the server' : summary?.token === 'settings' ? 'Settings' : 'nowhere'}
            </p>
          )}
        </div>
        <Button
          type="button"
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await buildGhlSetupAction();
              if (!result.ok) setError(result.error);
              else setRun({ ran_at: new Date().toISOString(), ok: !resultFailures(result.summary).length, summary: result.summary });
            });
          }}
        >
          {pending ? 'Building…' : 'Build in GHL'}
        </Button>
      </div>

      {error && <p className="text-sm text-[var(--ws-error)]">{error}</p>}

      {summary && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1 text-sm text-neutral-300">
            <p>Tags: {summary.tags.renamed.length} renamed, {summary.tags.created.length} created, {summary.tags.present} already there</p>
            <p>Fields: {summary.fields.created.length} created, {summary.fields.present} already there</p>
            <p>
              Pipeline: {summary.pipeline.name || 'none'}
              {summary.pipeline.created ? ' (created)' : ''}
              {summary.pipeline.stagesAdded.length ? ` · ${summary.pipeline.stagesAdded.length} stages added` : ''}
            </p>
            <p>Leads: {summary.leads.synced} in GHL, {summary.leads.contactsCreated} new contacts</p>
          </div>
          <div className="space-y-3">
            <Lines title="Renamed" items={summary.tags.renamed} />
            <Lines title="Problems" items={failures} tone="error" />
          </div>
        </div>
      )}
    </section>
  );
}

function resultFailures(summary: GhlSetupSummary): string[] {
  return [
    ...summary.errors,
    ...summary.tags.failed,
    ...summary.fields.failed,
    ...(summary.pipeline.error ? [summary.pipeline.error] : []),
    ...summary.leads.failed,
  ];
}
