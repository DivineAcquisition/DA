import Backdrop from '@/app/components/Backdrop';
import Logo from '@/app/components/Logo';

/** Shown when the Supabase environment variables are absent. */
export default function NotConfigured() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-5 text-white antialiased">
      <Backdrop />
      <div className="panel relative z-10 w-full max-w-lg rounded-3xl p-8">
        <Logo className="h-6 w-auto" />
        <h1 className="mt-6 text-xl font-semibold">Database not connected</h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-400">
          This surface reads from Supabase. Set the two environment variables below and redeploy.
        </p>
        <pre className="mt-5 overflow-x-auto rounded-xl border border-white/[0.07] bg-black/40 px-4 py-3.5 text-xs leading-relaxed text-neutral-300">
          NEXT_PUBLIC_SUPABASE_URL{'\n'}NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
        </pre>
        <p className="mt-4 text-xs leading-relaxed text-neutral-500">
          Both are in the Supabase dashboard under Project Settings, API keys. Use the publishable key,
          never the secret one — anything prefixed <code className="text-neutral-400">NEXT_PUBLIC_</code> is
          sent to the browser.
        </p>
      </div>
    </div>
  );
}
