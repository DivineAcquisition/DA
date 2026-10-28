import TeamNav from '../TeamNav';
import { GhlNav } from './ui';

export default function GhlLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TeamNav />
      <GhlNav />
      {children}
    </>
  );
}
