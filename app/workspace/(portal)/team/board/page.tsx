import type { Metadata } from 'next';
import type { BoardRow } from '@/lib/team/types';
import BoardView from '../BoardView';
import TeamNav from '../TeamNav';
import { Refused, teamRead } from '../teamRead';

export const metadata: Metadata = { title: "Team board" };
export const dynamic = 'force-dynamic';

export default async function Page() {
  const { data, error } = await teamRead<BoardRow[]>('staff_team_board');
  return (
    <>
      <TeamNav />
      {error || !data ? <Refused error={error ?? 'Not available.'} /> : <BoardView rows={data} />}
    </>
  );
}
