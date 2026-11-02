'use client';

import { hubSignOutAction } from '@/lib/vistrial/authActions';

/** The same quiet sign-out control on every team screen. */
export default function SignOutButton({
  label = 'Sign out',
  className = '',
  full = true,
}: {
  label?: string;
  className?: string;
  full?: boolean;
}) {
  return (
    <form action={hubSignOutAction} className={className}>
      <button type="submit" className={`auth-alt ${full ? 'w-full' : ''}`}>
        {label}
      </button>
    </form>
  );
}
