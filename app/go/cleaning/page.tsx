import { redirect } from 'next/navigation';

/** The offer lives on the cleaning host home page. */
export default function CleaningPathRedirect() {
  redirect('/');
}
