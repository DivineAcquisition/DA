import type { Metadata } from 'next';
import { loadPortal } from '@/lib/portal/load';
import type { FormalNotice } from '@/lib/portal/types';
import { renderPortal } from '../../components/frame';
import { NoticeView } from '../../components/MenuViews';

export const metadata: Metadata = { title: 'Formal notice' };
export const dynamic = 'force-dynamic';

export default async function NoticePage({ params }: { params: Promise<{ noticeId: string }> }) {
  const { noticeId } = await params;
  const load = await loadPortal<FormalNotice>('notice', (rpc) => rpc<FormalNotice>('portal_formal_notice', { p_notice_id: noticeId }));
  return renderPortal(load, 'notice', (data) => <NoticeView notice={data} />);
}
