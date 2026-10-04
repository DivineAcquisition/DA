'use client';

import { useEffect, useState } from 'react';
import { sendSimulationTurn, submitSimulationLog } from '@/lib/academy/simActions';

type Message = { role?: string; body?: string; at?: string };

function formatSeconds(total: number) {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function Clock({ startedAt, limitSeconds }: { startedAt: string; limitSeconds?: number | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const elapsed = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const remaining = typeof limitSeconds === 'number' ? Math.max(0, limitSeconds - elapsed) : null;
  return (
    <p className="text-sm text-neutral-300">
      Clock {formatSeconds(elapsed)}
      {remaining !== null ? ` · ${formatSeconds(remaining)} left` : ''}
    </p>
  );
}

export default function SimChat({
  moduleId,
  simId,
  sessionId,
  status,
  messages,
  preview = false,
  leadFirstAt,
  timeLimitSeconds,
  maxTurns,
}: {
  moduleId: string;
  simId: string;
  sessionId: string;
  status: string;
  messages: Message[];
  preview?: boolean;
  leadFirstAt?: string | null;
  timeLimitSeconds?: number | null;
  maxTurns?: number;
}) {
  const [body, setBody] = useState('');
  const logging = status === 'logging' || status === 'submitted';
  const turns = messages.filter((message) => message.role === 'operator').length;
  return (
    <div className="space-y-4">
      {leadFirstAt ? <Clock startedAt={leadFirstAt} limitSeconds={timeLimitSeconds} /> : null}
      {typeof maxTurns === 'number' ? <p className="text-sm text-neutral-300">Turns {turns} of {maxTurns}.</p> : null}
      <ol className="space-y-3">
        {messages.map((message, index) => (
          <li key={`${message.at ?? index}`} className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${message.role === 'operator' ? 'ml-auto bg-[#6A00FF]' : 'bg-white/10'}`}>
            {message.body}
          </li>
        ))}
      </ol>
      {status === 'open' ? (
        <form action={sendSimulationTurn.bind(null, moduleId, simId)} className="space-y-3">
          <input type="hidden" name="session" value={sessionId} />
          {preview ? <input type="hidden" name="preview" value="1" /> : null}
          <textarea
            name="body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={3}
            required
            className="w-full rounded-2xl border border-white/10 bg-transparent px-4 py-3 text-base"
            placeholder="Reply as the operator"
          />
          <button type="submit" className="min-h-11 w-full rounded-xl bg-[#6A00FF] text-sm font-semibold">
            Send
          </button>
        </form>
      ) : null}
      {status === 'open' || logging ? (
        <form action={submitSimulationLog.bind(null, moduleId, simId)} className="space-y-3 rounded-3xl border border-white/10 p-4">
          <input type="hidden" name="session" value={sessionId} />
          {preview ? <input type="hidden" name="preview" value="1" /> : null}
          <p className="text-sm font-semibold">Interaction log</p>
          <textarea name="outcome" required rows={2} placeholder="Outcome" className="w-full rounded-xl border border-white/10 bg-transparent px-3 py-2 text-sm" />
          <textarea name="learned" required rows={2} placeholder="What you learned about the lead" className="w-full rounded-xl border border-white/10 bg-transparent px-3 py-2 text-sm" />
          <textarea name="next" required rows={2} placeholder="Agreed next step" className="w-full rounded-xl border border-white/10 bg-transparent px-3 py-2 text-sm" />
          <textarea name="notes" rows={2} placeholder="Notes" className="w-full rounded-xl border border-white/10 bg-transparent px-3 py-2 text-sm" />
          <button type="submit" className="min-h-11 w-full rounded-xl border border-white/15 text-sm font-semibold">
            Finish and submit
          </button>
        </form>
      ) : null}
    </div>
  );
}
