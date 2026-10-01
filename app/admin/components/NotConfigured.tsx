import Backdrop from '@/app/components/Backdrop';
import Logo from '@/app/components/Logo';

export default function NotConfigured() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-5 text-white antialiased">
      <Backdrop />
      <div className="panel relative z-10 w-full max-w-md rounded-3xl p-8 text-center">
        <Logo className="mx-auto h-6 w-auto" />
        <h1 className="mt-6 text-xl font-semibold">Not connected</h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-400">
          This deploy cannot see a Supabase URL and key. Confirm both are set for Production, then
          redeploy so the new values are picked up.
        </p>
        <pre className="mt-5 overflow-x-auto rounded-xl border border-white/[0.07] bg-black/40 px-4 py-3.5 text-left text-xs leading-relaxed text-neutral-300">
          NEXT_PUBLIC_SUPABASE_URL{'\n'}
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY{'\n'}
          {'  '}(or NEXT_PUBLIC_SUPABASE_ANON_KEY)
        </pre>
      </div>
    </div>
  );
}
