import type { Metadata } from 'next';
import Link from 'next/link';
import Logo from '@/app/components/Logo';
import { cleaningSettings } from '@/lib/cleaning/settings';
import { CleaningCallback } from '../cleaning/Pixel';
import '../cleaning/cleaning.css';

export const metadata: Metadata = {
  title: { absolute: 'Request received | Divine Acquisition' },
  robots: { index: false, follow: false },
};

export default async function ThanksPage({ searchParams }: { searchParams: Promise<{ name?: string }> }) {
  const { name } = await searchParams;
  const first = (name ?? '').replace(/[^\p{L}\p{M}\s'-]/gu, '').trim().slice(0, 40);
  const scheduler = cleaningSettings.schedulerUrl;

  return (
    <div className="acq-coaches clean-page">
      <CleaningCallback />
      <header className="clean-top">
        <Link href="/" aria-label="Divine Acquisition">
          <Logo className="h-7 w-auto" />
        </Link>
      </header>
      <main className="clean-section">
        <div className="clean-wrap">
          <h1>Got it{first ? `, ${first}` : ''}.</h1>
          <p>
            {cleaningSettings.callbackPromise} The call takes about five minutes. We&apos;ll confirm a few details and set up your audit.
          </p>
          {scheduler ? (
            <a className="clean-secondary" href={scheduler}>
              Pick a time
            </a>
          ) : null}
        </div>
      </main>
    </div>
  );
}
