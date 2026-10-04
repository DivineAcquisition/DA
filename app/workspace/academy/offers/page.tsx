import { redirect } from 'next/navigation';
import { academyAdminSession } from '@/lib/academy/access';
import { saveOfferPack } from '@/lib/academy/simActions';
import { Button, Field, Input, Textarea } from '../../components/ui';

export const metadata = { title: 'Offer Pack' };

export default async function OffersPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await academyAdminSession();
  if (!session) redirect('/workspace/overview');
  const params = await searchParams;
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
      <h1 className="text-2xl font-semibold text-white">Offer Pack</h1>
      <p className="text-sm text-neutral-400">One section per offer. Separate offers with a line that contains only ---. Saving creates a new version and keeps the old one.</p>
      {params.error ? <p className="text-sm text-flag-critical">{params.error}</p> : null}
      <form action={saveOfferPack} className="space-y-3">
        <Field label="Name"><Input name="name" defaultValue="Offer Pack" /></Field>
        <Field label="Offers">
          <Textarea name="body" rows={12} placeholder={'Med Spa\nDo not promise a result.'} />
        </Field>
        <Button type="submit">Save new version</Button>
      </form>
    </div>
  );
}