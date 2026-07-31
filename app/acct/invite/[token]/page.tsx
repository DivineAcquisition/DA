import { AcceptClientInviteForm } from './AcceptClientInviteForm';

export const dynamic = 'force-dynamic';

export default async function ClientInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <AcceptClientInviteForm token={token} />;
}
