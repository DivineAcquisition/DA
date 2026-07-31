import Backdrop from '@/app/components/Backdrop';
import Logo from '@/app/components/Logo';
import { eyebrow } from '@/app/components/ui';

export default function AssessmentRootPage() {
  return (
    <div className="min-h-screen bg-ink-950 text-white antialiased">
      <Backdrop />
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-5 py-16 text-center">
        <Logo className="h-7 w-auto" />
        <p className={`${eyebrow} mt-10`}>Assessment booking</p>
        <h1 className="mt-5 max-w-lg text-3xl font-semibold sm:text-4xl">
          You need a personal link
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-neutral-400">
          Assessment calls are scheduled through a private invite that expires in 24 hours. Check your
          email for the link, or ask your Divine Acquisition contact for a fresh one.
        </p>
      </div>
    </div>
  );
}
