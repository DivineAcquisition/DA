import type { Metadata } from 'next';
import { loadPortal } from '@/lib/portal/load';
import type { TasksData } from '@/lib/portal/types';
import { renderPortal } from '../components/frame';
import TasksView from '../components/TasksView';

export const metadata: Metadata = { title: 'Tasks & Training' };
export const dynamic = 'force-dynamic';

export default async function TasksPage() {
  const load = await loadPortal<TasksData>('tasks', (rpc) => rpc<TasksData>('portal_tasks'));
  return renderPortal(load, 'tasks', (data) => <TasksView data={data} />);
}
