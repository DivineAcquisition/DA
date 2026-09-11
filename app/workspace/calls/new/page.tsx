import Link from 'next/link';
import { PageHeader } from '../../components/ui';
import NewCallForm from '../components/NewCallForm';

export const dynamic = 'force-dynamic';

export default function NewCallPage() {
  return (
    <div className="animate-rise mx-auto w-full max-w-[640px]">
      <PageHeader
        title="New call"
        description="Select a niche first. The qualifying script, roles, and size questions follow that niche."
        actions={
          <Link href="/workspace/calls" className="text-sm text-brand-300 hover:underline">
            Back to calls
          </Link>
        }
      />
      <NewCallForm />
    </div>
  );
}
