import type { Metadata } from 'next';
import { controlRpc, readable } from '@/lib/ad/rpc';
import { createClient } from '@/lib/supabase/server';
import InboxView, { type InboxData } from './InboxView';

export const metadata: Metadata = { title: 'Inbox' };
export const dynamic = 'force-dynamic';

/** What the portal sent to this staff member: escalations, missed shifts, pay questions. */
export default async function InboxPage() {
  const supabase = await createClient();
  const { data, error } = await controlRpc<InboxData>(supabase, 'staff_notifications', { p_limit: 100 });
  return <InboxView data={data ?? { unread: 0, items: [] }} error={error ? readable(error) : null} />;
}
