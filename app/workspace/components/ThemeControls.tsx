'use client';

import { Moon, Sun } from 'lucide-react';
import { useLayoutEffect, useSyncExternalStore } from 'react';
import { applyTheme, leaveWorkspaceTheme, readTheme, saveTheme, storedTheme, type Theme } from '@/lib/workspace/theme';

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
}

export function useTheme(): [Theme, (theme: Theme) => void] {
  const theme = useSyncExternalStore(subscribe, readTheme, () => 'dark' as Theme);
  return [theme, saveTheme];
}

/** Keeps the saved choice on <html> for the signed-in team and admin shells. */
export function ThemeFrame({ children }: { children: React.ReactNode }) {
  useLayoutEffect(() => {
    applyTheme(storedTheme());
    document.cookie = 'da-workspace=1; path=/; max-age=31536000; SameSite=Lax';
    return () => leaveWorkspaceTheme();
  }, []);
  return children;
}

/** Sun switches to white. Moon switches to black. */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useTheme();
  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  const label = next === 'dark' ? 'Switch to the dark theme' : 'Switch to the light theme';
  const Icon = theme === 'dark' ? Sun : Moon;
  return (
    <button type="button" className={`theme-toggle ${className}`} aria-label={label} aria-pressed={theme === 'dark'} onClick={() => setTheme(next)}>
      <Icon className="size-4" strokeWidth={1.8} aria-hidden />
    </button>
  );
}
