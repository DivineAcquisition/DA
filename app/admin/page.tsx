import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/** Assessment booking now lives on the unified Calendar page. */
export default function AssessmentAdminPage() {
  redirect('/workspace/calendar-links');
}
