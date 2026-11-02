'use client';

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

/** White and black, the same two themes as the Vistrial workspace. */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useTheme();
  return (
    <div role="group" aria-label="Color theme" className={`theme-toggle ${className}`}>
      <button type="button" aria-pressed={theme === 'light'} onClick={() => setTheme('light')}>
        <span className="theme-toggle-full">White</span>
        <span className="theme-toggle-short">W</span>
      </button>
      <button type="button" aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>
        <span className="theme-toggle-full">Black</span>
        <span className="theme-toggle-short">B</span>
      </button>
    </div>
  );
}
