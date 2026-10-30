import { Resend } from 'resend';
import { appUrl } from '@/lib/apps';
import { ensureDriveFolder, uploadFile } from '@/lib/drive/client';
import { serviceClient, type UntypedClient } from '@/lib/workspace/db';
import { buildClientReportEmail } from './email';
import { asClientReport, reportFileName } from './client';
import { buildClientReportPdf } from './pdf';

type Claim = {
  id: string;
  test: boolean;
  kind: string;
  resend_count: number;
  resend_pending: boolean;
  token_id: string | null;
  drive_file_id: string | null;
  to: string[];
  cc: string[];
  reply_to: string | null;
  from_name: string;
  from_address: string;
  origin: string;
  drive_enabled: boolean;
  drive_folder_id: string | null;
  discord_enabled: boolean;
  airtable_enabled: boolean;
  clickup_enabled: boolean;
  client: unknown;
};

type Due = {
  id: string;
  channel: string;
  destination: string;
  subject_type: string;
  subject_id: string;
  report_id: string | null;
  placement_id: string | null;
  payload: { text?: string; title?: string; comment?: string; link?: string; manager?: string; match_placement?: string };
  external_id: string | null;
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

async function note(db: UntypedClient, reportId: string, placementId: string | null, channel: string, destination: string, subject: string, ok: boolean, error?: string, external?: string) {
  await db.rpc('so_delivery_note', {
    p_report: reportId,
    p_placement: placementId,
    p_channel: channel,
    p_destination: destination,
    p_subject: subject,
    p_ok: ok,
    p_error: error ?? null,
    p_external: external ?? null,
  });
}

async function secret(db: UntypedClient, kind: string, placement?: string | null): Promise<string | null> {
  const { data } = await db.rpc('so_report_secret', { p_kind: kind, p_placement: placement ?? null });
  return typeof data === 'string' && data ? data : null;
}

async function postDiscord(webhook: string, text: string) {
  const response = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: text.slice(0, 1800) }),
  });
  if (!response.ok) throw new Error(`Discord returned ${response.status}`);
}

async function saveDrive(report: ReturnType<typeof asClientReport>, folderId: string, bytes: Uint8Array) {
  const year = report.period_end.slice(0, 4);
  const monthIndex = Number(report.period_end.slice(5, 7)) - 1;
  const month = MONTHS[monthIndex] ?? report.period_end.slice(0, 7);
  const clientFolder = await ensureDriveFolder(report.client, folderId);
  const yearFolder = await ensureDriveFolder(year, clientFolder.id);
  const monthFolder = await ensureDriveFolder(month, yearFolder.id);
  const file = await uploadFile(monthFolder.id, reportFileName(report), 'application/pdf', bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  return file;
}

async function sendEmail(claim: Claim, pdf: Uint8Array, reportUrl: string | null) {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) throw new Error('RESEND_API_KEY is not set');
  if (!claim.reply_to) throw new Error('No reply-to address is set');
  if (!claim.to?.length) throw new Error('Add at least one recipient');
  const mail = buildClientReportEmail(claim.client, { reportUrl });
  const resend = new Resend(key);
  const result = await resend.emails.send(
    {
      from: `${claim.from_name} <${claim.from_address}>`,
      to: claim.to,
      cc: claim.cc?.filter(Boolean),
      replyTo: claim.reply_to,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      attachments: [{ filename: reportFileName(asClientReport(claim.client)), content: Buffer.from(pdf) }],
    },
    { idempotencyKey: `sales-report/${claim.id}/${claim.resend_count}` },
  );
  if (result.error) throw new Error(result.error.message);
  return result.data?.id ?? '';
}

async function sendOne(db: UntypedClient, claim: Claim) {
  const report = asClientReport(claim.client);
  const subject = `${claim.id}:${claim.resend_count}`;
  let pdf: Uint8Array;
  try {
    pdf = buildClientReportPdf(report);
    await note(db, claim.id, null, 'pdf', 'file', subject, true);
  } catch (error) {
    await note(db, claim.id, null, 'pdf', 'file', subject, false, error instanceof Error ? error.message : 'PDF failed');
    await db.rpc('so_report_finish', { p_id: claim.id, p_ok: false, p_error: error instanceof Error ? error.message : 'PDF failed' });
    return;
  }

  if (claim.drive_enabled && claim.drive_folder_id && !claim.drive_file_id) {
    try {
      const file = await saveDrive(report, claim.drive_folder_id, pdf);
      await note(db, claim.id, null, 'drive', 'shared-drive', claim.id, true, undefined, `${file.id}|${file.webViewLink}`);
    } catch (error) {
      await note(db, claim.id, null, 'drive', 'shared-drive', claim.id, false, error instanceof Error ? error.message : 'Drive save failed');
    }
  }

  let token: string | null = null;
  let reportUrl: string | null = null;
  if (!claim.test) {
    try {
      const minted = await db.rpc('so_report_mint', { p_report: claim.id });
      token = typeof minted.data === 'string' ? minted.data : null;
      if (token) reportUrl = `${claim.origin.replace(/\/+$/, '')}/r/${token}`;
    } catch (error) {
      await note(db, claim.id, null, 'email', 'token', subject, false, error instanceof Error ? error.message : 'Token failed');
    }
  }

  let emailOk = false;
  let emailError = '';
  try {
    const id = await sendEmail(claim, pdf, reportUrl && !reportUrl.endsWith('/r/') ? reportUrl : null);
    emailOk = true;
    await note(db, claim.id, null, 'email', claim.to.join(','), subject, true, undefined, id);
  } catch (error) {
    emailError = error instanceof Error ? error.message : 'Email failed';
    await note(db, claim.id, null, 'email', (claim.to ?? []).join(',') || 'none', subject, false, emailError);
  }

  if (claim.discord_enabled) {
    try {
      const hook = await secret(db, 'discord_ops');
      if (!hook) throw new Error('Discord ops webhook is not stored');
      await postDiscord(hook, `${report.test ? 'TEST ' : ''}${report.kind} report ${emailOk ? 'sent' : 'failed'} for ${report.client} (${report.period_start}).`);
      await note(db, claim.id, null, 'discord', 'ops', subject, true);
    } catch (error) {
      await note(db, claim.id, null, 'discord', 'ops', subject, false, error instanceof Error ? error.message : 'Discord failed');
    }
  }

  if (claim.airtable_enabled) {
    try {
      await syncAirtable(db);
      await note(db, claim.id, null, 'airtable', 'base', subject, true);
    } catch (error) {
      await note(db, claim.id, null, 'airtable', 'base', subject, false, error instanceof Error ? error.message : 'Airtable failed');
    }
  }

  if (claim.clickup_enabled && !claim.test) {
    try {
      const taskId = await clickupReportTask(db, report, claim.drive_file_id);
      await note(db, claim.id, null, 'clickup', 'report', subject, true, undefined, taskId);
    } catch (error) {
      await note(db, claim.id, null, 'clickup', 'report', subject, false, error instanceof Error ? error.message : 'ClickUp failed');
    }
  }

  await db.rpc('so_report_finish', { p_id: claim.id, p_ok: emailOk, p_error: emailError || null });
}

async function airtableHeaders(db: UntypedClient) {
  const token = await secret(db, 'airtable');
  const { data: setting } = await db.from('team_setting').select('report_airtable_base_id').eq('id', 1).maybeSingle();
  const baseId = setting?.report_airtable_base_id as string | undefined;
  if (!token || !baseId) throw new Error('Airtable is not connected');
  return { token, baseId, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } };
}

const AIRTABLE_TABLES: { name: string; fields: { name: string; type: string }[] }[] = [
  { name: 'Operators', fields: ['Name', 'Role', 'Placement status', 'Client', 'Manager', 'Certification level', 'DA ID'].map((name) => ({ name, type: name === 'Certification level' ? 'number' : 'singleLineText' })) },
  { name: 'Placements', fields: ['Operator', 'Client', 'Type', 'Status', 'Start date', 'Manager', 'DA ID'].map((name) => ({ name, type: 'singleLineText' })) },
  { name: 'EODs', fields: ['Operator', 'Client', 'Date', 'Status', 'On time', 'Submitted time', 'Wins', 'Blockers', 'Tomorrow plan', 'Needs help', 'Feedback count', 'DA ID'].map((name) => ({ name, type: name === 'Needs help' ? 'checkbox' : name === 'Feedback count' ? 'number' : 'singleLineText' })) },
  { name: 'Daily Metrics', fields: ['Operator', 'Client', 'Date', 'Metric', 'Value', 'DA ID'].map((name) => ({ name, type: name === 'Value' ? 'number' : 'singleLineText' })) },
  { name: 'Reports', fields: ['Client', 'Period', 'Type', 'Status', 'Sent time', 'Recipients count', 'Drive link', 'DA ID'].map((name) => ({ name, type: name === 'Recipients count' ? 'number' : 'singleLineText' })) },
  { name: 'Client Feedback', fields: ['Client', 'Report', 'Rating', 'Comments', 'Inaccurate', 'Submitted time', 'DA ID'].map((name) => ({ name, type: name === 'Rating' ? 'number' : name === 'Inaccurate' ? 'checkbox' : 'singleLineText' })) },
];

async function ensureAirtableTables(auth: { token: string; baseId: string; headers: Record<string, string> }) {
  const listed = await fetch(`https://api.airtable.com/v0/meta/bases/${auth.baseId}/tables`, { headers: auth.headers });
  if (!listed.ok) throw new Error(`Airtable tables returned ${listed.status}`);
  const body = (await listed.json()) as { tables?: { name: string }[] };
  const have = new Set((body.tables ?? []).map((table) => table.name));
  for (const table of AIRTABLE_TABLES) {
    if (have.has(table.name)) continue;
    const created = await fetch(`https://api.airtable.com/v0/meta/bases/${auth.baseId}/tables`, {
      method: 'POST',
      headers: auth.headers,
      body: JSON.stringify({ name: table.name, fields: table.fields.map((field) => ({ name: field.name, type: field.type })) }),
    });
    if (!created.ok) throw new Error(`Airtable could not create ${table.name}`);
  }
}

async function upsertAirtable(auth: { baseId: string; headers: Record<string, string> }, table: string, row: Record<string, unknown>) {
  const id = String(row['DA ID'] ?? '');
  const formula = encodeURIComponent(`{DA ID}='${id.replace(/'/g, "\\'")}'`);
  const found = await fetch(`https://api.airtable.com/v0/${auth.baseId}/${encodeURIComponent(table)}?filterByFormula=${formula}&maxRecords=1`, { headers: auth.headers });
  if (!found.ok) throw new Error(`Airtable read ${table} returned ${found.status}`);
  const existing = (await found.json()) as { records?: { id: string }[] };
  const fields = { ...row };
  const recordId = existing.records?.[0]?.id;
  const response = recordId
    ? await fetch(`https://api.airtable.com/v0/${auth.baseId}/${encodeURIComponent(table)}/${recordId}`, { method: 'PATCH', headers: auth.headers, body: JSON.stringify({ fields }) })
    : await fetch(`https://api.airtable.com/v0/${auth.baseId}/${encodeURIComponent(table)}`, { method: 'POST', headers: auth.headers, body: JSON.stringify({ fields }) });
  if (!response.ok) throw new Error(`Airtable write ${table} returned ${response.status}`);
}

export async function syncAirtable(db: UntypedClient) {
  const auth = await airtableHeaders(db);
  await ensureAirtableTables(auth);
  const { data, error } = await db.rpc('so_airtable_export');
  if (error) throw new Error(error.message);
  const tables = data as Record<string, Record<string, unknown>[]>;
  for (const [name, rows] of Object.entries(tables ?? {})) {
    for (const row of rows ?? []) {
      const safe = Object.fromEntries(Object.entries(row).filter(([key]) => !['mismatch', 'pay', 'payout', 'credential'].includes(key.toLowerCase())));
      await upsertAirtable(auth, name, safe);
    }
  }
}

async function clickupReportTask(db: UntypedClient, report: ReturnType<typeof asClientReport>, driveId: string | null) {
  const token = await secret(db, 'clickup');
  const { data: setting } = await db.from('team_setting').select('report_clickup_folder_id, report_clickup_escalation_list_id').eq('id', 1).maybeSingle();
  const folder = setting?.report_clickup_folder_id as string | undefined;
  if (!token || !folder) throw new Error('ClickUp is not connected');
  const listId = await clickupList(token, folder, report.client);
  const headline = report.headline.slice(0, 4).map((item) => `${item.label}: ${item.value ?? '—'}`).join('\n');
  const response = await fetch(`https://api.clickup.com/api/v2/list/${listId}/task`, {
    method: 'POST',
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `${report.client} ${report.kind === 'daily' ? 'Daily' : 'Weekly'} Report ${report.period_start}${report.kind === 'weekly' ? ` to ${report.period_end}` : ''}`,
      markdown_description: `${headline}\n\n${driveId ? `Drive file ${driveId}` : 'PDF attached on the client email.'}`,
    }),
  });
  if (!response.ok) throw new Error(`ClickUp returned ${response.status}`);
  const body = (await response.json()) as { id?: string };
  return body.id ?? '';
}

async function clickupList(token: string, folderId: string, name: string) {
  const listed = await fetch(`https://api.clickup.com/api/v2/folder/${folderId}/list`, { headers: { Authorization: token } });
  if (!listed.ok) throw new Error(`ClickUp lists returned ${listed.status}`);
  const body = (await listed.json()) as { lists?: { id: string; name: string }[] };
  const found = body.lists?.find((list) => list.name === name);
  if (found) return found.id;
  const created = await fetch(`https://api.clickup.com/api/v2/folder/${folderId}/list`, {
    method: 'POST',
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!created.ok) throw new Error(`ClickUp could not create the ${name} list`);
  const list = (await created.json()) as { id: string };
  return list.id;
}

async function runDue(db: UntypedClient, item: Due) {
  try {
    if (item.channel === 'discord') {
      const kind = item.destination === 'escalations' ? 'discord_esc' : item.destination === 'client' ? 'placement_discord' : 'discord_ops';
      const hook = await secret(db, kind, item.destination === 'client' ? item.placement_id : null);
      if (!hook) throw new Error('That Discord webhook is not stored');
      const link = item.payload.link ? `${appUrl('admin')}${item.payload.link}` : '';
      const text = item.payload.text ?? item.payload.title ?? 'DA update';
      await postDiscord(hook, link && !text.includes('http') ? `${text}\n${link}` : text);
    } else if (item.channel === 'clickup') {
      const token = await secret(db, 'clickup');
      if (!token) throw new Error('ClickUp is not connected');
      if (item.payload.comment) {
        let taskId = item.external_id;
        if (!taskId) {
          const match = item.subject_id.replace(/:review$/, '').replace(/:resolved$/, '');
          const { data: sibling } = await db
            .from('sales_delivery')
            .select('external_id')
            .eq('channel', 'clickup')
            .eq('destination', 'escalations')
            .not('external_id', 'is', null)
            .or(`subject_id.eq.${match},placement_id.eq.${item.payload.match_placement ?? item.placement_id ?? '00000000-0000-0000-0000-000000000000'}`)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          taskId = (sibling?.external_id as string | undefined) ?? null;
        }
        if (!taskId) throw new Error('The ClickUp task is not created yet');
        const response = await fetch(`https://api.clickup.com/api/v2/task/${taskId}/comment`, {
          method: 'POST',
          headers: { Authorization: token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ comment_text: item.payload.comment }),
        });
        if (!response.ok) throw new Error(`ClickUp comment returned ${response.status}`);
      } else if (item.destination === 'escalations') {
        const { data: setting } = await db.from('team_setting').select('report_clickup_escalation_list_id, report_clickup_users').eq('id', 1).maybeSingle();
        const listId = setting?.report_clickup_escalation_list_id as string | undefined;
        if (!listId) throw new Error('The Ops Escalations list is not set');
        const users = (setting?.report_clickup_users ?? {}) as Record<string, string>;
        const assignee = item.payload.manager ? users[item.payload.manager] : undefined;
        const response = await fetch(`https://api.clickup.com/api/v2/list/${listId}/task`, {
          method: 'POST',
          headers: { Authorization: token, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: item.payload.title ?? 'Ops escalation',
            markdown_description: item.payload.link ? `${appUrl('admin')}${item.payload.link}` : 'Open the admin workspace.',
            assignees: assignee ? [Number(assignee) || assignee] : [],
          }),
        });
        if (!response.ok) throw new Error(`ClickUp returned ${response.status}`);
        const body = (await response.json()) as { id?: string };
        await db.rpc('so_delivery_result', { p_id: item.id, p_ok: true, p_error: null, p_external: body.id ?? null });
        return;
      }
    } else if (item.channel === 'airtable') {
      await syncAirtable(db);
    } else if (item.channel === 'drive' && item.report_id) {
      const { data: setting } = await db.from('team_setting').select('report_drive_folder_id, report_drive_enabled').eq('id', 1).maybeSingle();
      if (!setting?.report_drive_enabled || !setting.report_drive_folder_id) throw new Error('Google Drive is switched off');
      const { data: payload, error } = await db.rpc('so_report_payload', { p_id: item.report_id });
      if (error) throw new Error(error.message);
      const report = asClientReport(payload);
      const file = await saveDrive(report, setting.report_drive_folder_id as string, buildClientReportPdf(report));
      await db.rpc('so_delivery_result', { p_id: item.id, p_ok: true, p_error: null, p_external: `${file.id}|${file.webViewLink}` });
      return;
    }
    await db.rpc('so_delivery_result', { p_id: item.id, p_ok: true, p_error: null, p_external: item.external_id });
  } catch (error) {
    await db.rpc('so_delivery_result', {
      p_id: item.id,
      p_ok: false,
      p_error: error instanceof Error ? error.message : 'Delivery failed',
      p_external: null,
    });
  }
}

export async function runSalesReports() {
  const db = serviceClient();
  if (!db) return { ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY is required' };
  const summary = { claimed: 0, deliveries: 0, errors: [] as string[] };
  const sweep = await db.rpc('so_report_sweep');
  if (sweep.error) summary.errors.push(sweep.error.message);
  const caught = await db.rpc('so_outbound_catchup');
  if (caught.error) summary.errors.push(caught.error.message);
  const claimed = await db.rpc('so_report_claim', { p_limit: 3 });
  if (claimed.error) summary.errors.push(claimed.error.message);
  for (const row of (claimed.data ?? []) as Claim[]) {
    summary.claimed += 1;
    try {
      await sendOne(db, row);
    } catch (error) {
      summary.errors.push(error instanceof Error ? error.message : 'send failed');
      await db.rpc('so_report_finish', { p_id: row.id, p_ok: false, p_error: error instanceof Error ? error.message : 'send failed' });
    }
  }
  const due = await db.rpc('so_delivery_due', { p_limit: 20 });
  if (due.error) summary.errors.push(due.error.message);
  for (const item of (due.data ?? []) as Due[]) {
    if (item.channel === 'email' || item.channel === 'pdf') continue;
    summary.deliveries += 1;
    await runDue(db, item);
  }
  const day = new Date().toISOString().slice(0, 10);
  const { data: setting } = await db.from('team_setting').select('report_airtable_enabled').eq('id', 1).maybeSingle();
  if (setting?.report_airtable_enabled && new Date().getUTCHours() === 7) {
    const { data: already } = await db.from('sales_delivery').select('id').eq('subject_id', `nightly:${day}`).maybeSingle();
    if (!already) {
      try {
        await syncAirtable(db);
        await db.from('sales_delivery').insert({
          channel: 'airtable', destination: 'nightly', status: 'sent', subject_type: 'nightly', subject_id: `nightly:${day}`,
        });
      } catch (error) {
        summary.errors.push(error instanceof Error ? error.message : 'nightly airtable');
      }
    }
  }
  return { ok: summary.errors.length === 0, ...summary };
}

export async function testDestination(kind: 'discord_ops' | 'discord_esc' | 'airtable' | 'clickup' | 'drive') {
  const db = serviceClient();
  if (!db) return 'The server cannot read stored connections.';
  if (kind === 'drive') {
    const { data } = await db.from('team_setting').select('report_drive_folder_id').eq('id', 1).maybeSingle();
    if (!data?.report_drive_folder_id) return 'Paste the Shared Drive folder id first.';
    try {
      await ensureDriveFolder('Connection test', data.report_drive_folder_id as string);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : 'Drive test failed';
    }
  }
  if (kind === 'discord_ops' || kind === 'discord_esc') {
    const hook = await secret(db, kind);
    if (!hook) return 'Store the webhook first.';
    try {
      await postDiscord(hook, 'DA connection test. You can ignore this.');
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : 'Discord test failed';
    }
  }
  if (kind === 'airtable') {
    try {
      await syncAirtable(db);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : 'Airtable test failed';
    }
  }
  const token = await secret(db, 'clickup');
  if (!token) return 'Store the ClickUp token first.';
  const response = await fetch('https://api.clickup.com/api/v2/user', { headers: { Authorization: token } });
  return response.ok ? null : `ClickUp returned ${response.status}`;
}
