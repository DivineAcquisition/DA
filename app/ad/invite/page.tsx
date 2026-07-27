import { AcceptInviteForm } from './AcceptInviteForm';

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <AcceptInviteForm initialToken={token ?? ''} />;
}
