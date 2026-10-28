'use client';

import { useMemo, useState } from 'react';
import { formatDateTime } from '@/lib/portal/time';
import type { PlaybookData } from '@/lib/portal/types';
import { inputClass } from '../../components/ui';
import { Card, Empty, usePortal } from './portal';

type Section = { id: string; title: string; body: string | null; tone?: 'warning' };

/** Read-only, in sections a VA can jump between mid-conversation, with search. */
export default function PlaybookView({ data }: { data: PlaybookData }) {
  const { operatorZone } = usePortal();
  const [query, setQuery] = useState('');

  const sections: Section[] = useMemo(() => {
    if (!data.exists) return [];
    const about = [
      data.business_name ? `Answer as: ${data.business_name}` : null,
      data.offer,
      data.locations ? `Locations: ${data.locations}` : null,
      data.hours ? `Hours: ${data.hours}` : null,
    ]
      .filter(Boolean)
      .join('\n\n');
    return [
      { id: 'about', title: 'About the client', body: about || null },
      { id: 'qualifies', title: 'Who qualifies', body: data.qualifies ?? null },
      { id: 'disqualifiers', title: 'Disqualifiers', body: data.disqualifiers ?? null },
      {
        id: 'handoff',
        title: 'Handoff',
        body:
          [
            data.handoff_method === 'live_transfer'
              ? 'Live transfer to the front desk.'
              : data.handoff_method === 'calendar'
                ? "Book on the client's calendar."
                : null,
            data.handoff_steps,
          ]
            .filter(Boolean)
            .join('\n\n') || null,
      },
      { id: 'escalation', title: 'Escalation contacts', body: data.escalation_contacts ?? null },
      { id: 'never', title: 'Never say or do', body: data.never_say ?? null, tone: 'warning' },
      { id: 'pricing', title: 'Approved pricing and offers', body: data.approved_pricing ?? null },
      { id: 'holding', title: 'Holding lines', body: (data.holding_lines ?? []).map((line) => `“${line}”`).join('\n') || null },
    ];
  }, [data]);

  if (!data.available) {
    return (
      <Empty>
        This placement has ended, so its playbook is no longer available to you (Section 13.1).
      </Empty>
    );
  }
  if (!data.exists) {
    return <Empty>DA has not written the playbook for {data.client_name} yet. Escalate anything you are unsure about.</Empty>;
  }

  const q = query.trim().toLowerCase();
  const visible = q ? sections.filter((s) => `${s.title}\n${s.body ?? ''}`.toLowerCase().includes(q)) : sections;
  const scripts = (data.scripts ?? []).filter((s) => !q || `${s.title} ${s.description ?? ''}`.toLowerCase().includes(q));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Playbook: {data.client_name}</h1>
        <p className="mt-1 text-xs text-neutral-500">
          Version {data.version}
          {data.updated_at ? ` · updated ${formatDateTime(data.updated_at, operatorZone)}` : ''}
          {data.updated_by ? ` by ${data.updated_by}` : ''}
        </p>
      </div>

      <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the playbook" className={inputClass} />

      <nav className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" aria-label="Playbook sections">
        {sections.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="shrink-0 rounded-full bg-white/[0.05] px-3 py-1.5 text-xs text-neutral-300">
            {s.title}
          </a>
        ))}
        <a href="#scripts" className="shrink-0 rounded-full bg-white/[0.05] px-3 py-1.5 text-xs text-neutral-300">
          Scripts
        </a>
      </nav>

      {visible.map((section) => (
        <Card key={section.id} className={section.tone === 'warning' ? 'border border-flag-critical/30' : ''}>
          <h2 id={section.id} className={`scroll-mt-32 text-sm font-semibold ${section.tone === 'warning' ? 'text-flag-critical' : 'text-white'}`}>
            {section.title}
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-neutral-200">{section.body ?? 'Not set. Escalate if you need it.'}</p>
        </Card>
      ))}

      <Card>
        <h2 id="scripts" className="scroll-mt-32 text-sm font-semibold text-white">
          Scripts and templates
        </h2>
        <ul className="mt-2 space-y-2">
          {scripts.length === 0 ? <li className="text-sm text-neutral-500">None linked.</li> : null}
          {scripts.map((script) => (
            <li key={script.title}>
              {script.url ? (
                <a href={script.url} target="_blank" rel="noreferrer" className="text-sm text-brand-200 underline">
                  {script.title}
                </a>
              ) : (
                <span className="text-sm text-neutral-200">{script.title}</span>
              )}
              {script.description ? <p className="text-xs text-neutral-500">{script.description}</p> : null}
            </li>
          ))}
        </ul>
      </Card>
      {q && visible.length === 0 && scripts.length === 0 ? <Empty>Nothing in the playbook matches “{query}”.</Empty> : null}
    </div>
  );
}
