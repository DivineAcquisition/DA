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
          Supabase environment variables are missing on this deploy.
        </p>
      </div>
    </div>
  );
}
