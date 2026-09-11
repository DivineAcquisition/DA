import { listPractices } from '@/lib/workspace/practice-queries';
import PracticesList from './components/PracticesList';

export const dynamic = 'force-dynamic';

export default async function PracticesPage() {
  const practices = await listPractices();
  return (
    <div className="animate-rise">
      <PracticesList practices={practices} />
    </div>
  );
}
