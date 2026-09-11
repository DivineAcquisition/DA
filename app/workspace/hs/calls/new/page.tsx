import Link from 'next/link';
import { PageHeader } from '../../../components/ui';
import HsNewCallForm from '../components/HsNewCallForm';

export const dynamic = 'force-dynamic';

export default function HsNewCallPage() {
  return (
    <div className="animate-rise mx-auto w-full max-w-[640px]">
      <PageHeader
        title="New HS call"
        description="Create a qualifying call record, then open the live workspace."
        actions={
          <Link href="/workspace/hs/calls" className="text-sm text-[#937DFF] hover:underline">
            Back to HS calls
          </Link>
        }
      />
      <HsNewCallForm />
    </div>
  );
}
