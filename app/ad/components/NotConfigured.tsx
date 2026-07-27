import Backdrop from '@/app/components/Backdrop';
import Logo from '@/app/components/Logo';

export default function NotConfigured() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-5 text-white antialiased">
      <Backdrop />
      <div className="panel relative z-10 w-full max-w-lg rounded-3xl p-8">
        <Logo className="h-6 w-auto" />
        <h1 className="mt-6 text-xl font-semibold">Database not connected</h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-400">
          This surface reads from Supabase. Set the publishable URL and key, then redeploy.
        </p>
        <pre className="mt-5 overflow-x-auto rounded-xl border border-white/[0.07] bg-black/40 px-4 py-3.5 text-xs leading-relaxed text-neutral-300">
          NEXT_PUBLIC_SUPABASE_URL{'\n'}NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
        </pre>
      </div>
    </div>
  );
}
