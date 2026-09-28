import { redirect } from 'next/navigation';

/** The end-of-day page is now Shift Reports. */
export default function EodRedirect() {
  redirect('/vistrial/operator/reports');
}
