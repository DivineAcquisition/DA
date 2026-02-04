import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function Home() {
  const headersList = await headers();
  const hostname = headersList.get('host') || '';
  
  // Sales domain - redirect to booking interface
  if (hostname.includes('go.divineacquisition')) {
    redirect('/booking-interface');
  }
  
  // Default to hiring (for hiring.divineacquisition.io and other domains)
  redirect('/hiring');
}
