import { GhlNav } from './ui';

export default function GhlLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <GhlNav />
      {children}
    </>
  );
}
