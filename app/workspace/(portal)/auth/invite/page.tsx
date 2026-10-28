import { AcceptInviteForm } from '@/app/ad/invite/AcceptInviteForm';

/** Password setup for a Sales Operator. Served on the operator workspace at /auth/invite. */
export default async function TeamInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <AcceptInviteForm initialToken={token ?? ''} />;
}
