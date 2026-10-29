import { countTouches, talkMinutes, type GhlTouch } from './sales-count';
import { connect, type GhlSession, type ServiceClient } from './client';

type Due = {
  placement_id: string;
  case_file_id: string;
  ghl_user_id: string;
  time_zone: string;
  shift_start: string;
  shift_end: string;
  start_date: string;
  mapping: Record<string, unknown>;
  rerun_from: string | null;
  rerun_to: string | null;
  backfill_days: number;
  connect_seconds: number;
  conversation_seconds: number;
  reply_window_days: number;
};

/** Pull one placement. Read only. Counts go through so_apply_ghl_day. */
export async function syncSalesPlacement(db: ServiceClient, due: Due): Promise<void> {
  const picked = await connect(db, { caseFileId: due.case_file_id, purpose: 'location' });
  if (!picked.ok) {
    await db.rpc('so_ghl_sync_result', { p_placement: due.placement_id, p_ok: false, p_error: picked.reason, p_records: 0 });
    return;
  }
  const session = picked.session;
  try {
    const users = await session.request('GET', '/users/', { query: { locationId: session.info.locationId ?? '' }, purpose: 'sales sync users' });
    const calendars = await session.request('GET', '/calendars/', { query: { locationId: session.info.locationId ?? '' }, purpose: 'sales sync calendars' });
    const pipelines = await session.request('GET', '/opportunities/pipelines', { query: { locationId: session.info.locationId ?? '' }, purpose: 'sales sync pipelines' });
    if (users.ok || calendars.ok || pipelines.ok) {
      await db.rpc('so_ghl_save_catalog', {
        p_placement: due.placement_id,
        p_catalog: {
          users: listOf(users.data, 'users').map(userBrief),
          calendars: listOf(calendars.data, 'calendars').map(named),
          pipelines: listOf(pipelines.data, 'pipelines').map(named),
        },
      });
    }
    const conversations = await session.request('GET', '/conversations/search', {
      query: { locationId: session.info.locationId ?? '', limit: 50 },
      purpose: 'sales sync conversations',
    });
    const touches: GhlTouch[] = [];
    let records = 0;
    for (const conversation of listOf(conversations.data, 'conversations').slice(0, 20)) {
      const id = String(conversation.id ?? '');
      if (!id) continue;
      const messages = await session.request('GET', `/conversations/${id}/messages`, { query: { limit: 40 }, purpose: 'sales sync messages' });
      const rows = messageList(messages.data);
      records += rows.length;
      for (const row of rows) {
        const touch = asTouch(row, String(conversation.contactId ?? conversation.contact_id ?? ''));
        if (touch) touches.push(touch);
      }
    }
    const lines = countTouches(touches, {
      userId: due.ghl_user_id,
      connectSeconds: due.connect_seconds || 10,
      conversationSeconds: due.conversation_seconds || 60,
      replyWindowDays: due.reply_window_days || 7,
      recoveryWindowDays: 7,
    });
    const byDay = new Map<string, typeof lines>();
    for (const line of lines) {
      const day = workDate(line.at, due.time_zone);
      const bucket = byDay.get(day) ?? [];
      bucket.push(line);
      byDay.set(day, bucket);
    }
    if (byDay.size === 0) byDay.set(workDate(new Date().toISOString(), due.time_zone), []);
    const today = workDate(new Date().toISOString(), due.time_zone);
    const tasks = await session.request('GET', `/locations/${session.info.locationId}/tasks`, {
      query: { assignedTo: due.ghl_user_id },
      purpose: 'sales sync tasks',
    });
    const taskRows = listOf(tasks.data, 'tasks').map((task) => ({
      id: String(task.id ?? ''),
      title: String(task.title ?? 'GHL task'),
      due_on: String(task.dueDate ?? today).slice(0, 10),
      completed: task.completed === true || Boolean(task.dateCompleted) ? 'true' : 'false',
    })).filter((task) => task.id);
    const complete = ['dials_made', 'connects', 'conversations_held', 'talk_time_minutes', 'texts_sent', 'emails_sent', 'replies_received'];
    for (const [day, dayLines] of byDay) {
      const counts = rollup(dayLines, touches);
      await db.rpc('so_apply_ghl_day', {
        p_placement: due.placement_id,
        p_day: day,
        p_counts: counts,
        p_evidence: dayLines.map((line) => ({ metric: line.metric, ghl_id: line.ghlId, ghl_type: line.metric, at: line.at, contact_id: line.contactId })),
        p_complete: complete,
        p_leads: [],
        p_tasks: day === today && tasks.ok ? taskRows : [],
      });
    }
    await db.rpc('so_ghl_sync_result', {
      p_placement: due.placement_id,
      p_ok: conversations.ok || users.ok,
      p_error: conversations.ok ? null : conversations.error,
      p_records: records,
    });
  } catch (error) {
    await db.rpc('so_ghl_sync_result', {
      p_placement: due.placement_id,
      p_ok: false,
      p_error: error instanceof Error ? error.message : 'Sync failed',
      p_records: 0,
    });
  }
}

export async function syncDueSales(db: ServiceClient, deadline: number): Promise<number> {
  const { data, error } = await db.rpc('so_ghl_due');
  if (error || !Array.isArray(data)) return 0;
  let done = 0;
  for (const row of data as Due[]) {
    if (Date.now() > deadline) break;
    await syncSalesPlacement(db, row);
    done += 1;
  }
  return done;
}

function rollup(lines: { metric: string; ghlId: string }[], touches: GhlTouch[]) {
  const totals = new Map<string, number>();
  for (const line of lines) {
    if (line.metric === 'conversations_held') continue;
    totals.set(line.metric, (totals.get(line.metric) ?? 0) + 1);
  }
  const conversations = lines.filter((line) => line.metric === 'conversations_held').length;
  totals.set('conversations_held', conversations);
  totals.set('talk_time_minutes', talkMinutes(lines, touches));
  return [...totals.entries()].filter(([, value]) => value > 0).map(([metric, value]) => ({ metric, value }));
}

function workDate(iso: string, zone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

function listOf(data: unknown, key: string): Record<string, unknown>[] {
  if (!data || typeof data !== 'object') return [];
  const record = data as Record<string, unknown>;
  const value = record[key] ?? record.data ?? data;
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object') : [];
}

function messageList(data: unknown): Record<string, unknown>[] {
  if (!data || typeof data !== 'object') return [];
  const record = data as Record<string, unknown>;
  const messages = record.messages;
  if (messages && typeof messages === 'object' && Array.isArray((messages as { messages?: unknown }).messages)) {
    return (messages as { messages: Record<string, unknown>[] }).messages;
  }
  return listOf(data, 'messages');
}

function userBrief(row: Record<string, unknown>) {
  return { id: String(row.id ?? ''), name: String(row.name ?? ''), email: String(row.email ?? '') };
}

function named(row: Record<string, unknown>) {
  return { id: String(row.id ?? ''), name: String(row.name ?? '') };
}

function asTouch(row: Record<string, unknown>, contactId: string): GhlTouch | null {
  const type = String(row.messageType ?? row.type ?? '').toLowerCase();
  const kind = type.includes('call') ? 'call' : type.includes('email') ? 'email' : type.includes('sms') || type.includes('text') ? 'text' : null;
  if (!kind) return null;
  const direction = String(row.direction ?? '').toLowerCase() === 'inbound' ? 'inbound' : 'outbound';
  const meta = (row.meta ?? {}) as Record<string, unknown>;
  const call = (meta.call ?? meta) as Record<string, unknown>;
  return {
    id: String(row.id ?? row.messageId ?? ''),
    contactId: String(row.contactId ?? contactId),
    at: String(row.dateAdded ?? row.date ?? new Date().toISOString()),
    kind,
    direction,
    userId: row.userId ? String(row.userId) : null,
    source: row.source ? String(row.source) : null,
    durationSeconds: Number(call.duration ?? row.callDuration ?? 0) || 0,
    answered: String(call.status ?? '').toLowerCase() === 'completed',
  };
}

export async function testSalesConnection(db: ServiceClient, caseFileId: string): Promise<{ ok: true; users: { id: string; name: string; email: string }[] } | { ok: false; error: string }> {
  const picked = await connect(db, { caseFileId, purpose: 'location' });
  if (!picked.ok) return { ok: false, error: picked.reason };
  const users = await readUsers(picked.session);
  if (!users.ok) return users;
  return { ok: true, users: users.users };
}

async function readUsers(session: GhlSession) {
  const response = await session.request('GET', '/users/', { query: { locationId: session.info.locationId ?? '' }, purpose: 'sales connection test' });
  if (!response.ok) return { ok: false as const, error: response.error ?? 'The sub-account did not answer.' };
  return { ok: true as const, users: listOf(response.data, 'users').map(userBrief).filter((user) => user.id) };
}
