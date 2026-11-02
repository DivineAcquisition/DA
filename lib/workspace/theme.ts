/**
 * Team and admin workspaces follow Vistrial: white by default, black when
 * the person switches. The public site stays on the dark class.
 */

export type Theme = 'light' | 'dark';

export const THEME_KEY = 'da-theme';
export const WORKSPACE_KEY = 'da-workspace';

export const THEME_COLOR: Record<Theme, string> = {
  light: '#ffffff',
  dark: '#07070b',
};

/** True when this document should paint the workspace palette before hydration. */
export function workspaceThemeActive(pathname: string, hasWorkspaceCookie: boolean): boolean {
  if (!hasWorkspaceCookie) return false;
  if (pathname !== '/workspace' && !pathname.startsWith('/workspace/')) return false;
  if (/\/(forgot-password|reset-password|auth)(\/|$)/.test(pathname)) return false;
  if (/\/login\/?$/.test(pathname)) return false;
  return true;
}

export function readTheme(): Theme {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function storedTheme(): Theme {
  if (typeof document === 'undefined') return 'light';
  const match = document.cookie.match(new RegExp(`(?:^|; )${THEME_KEY}=(light|dark)`));
  if (match) return match[1] as Theme;
  try {
    return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.setAttribute('data-product', 'workspace');
  root.classList.toggle('dark', theme === 'dark');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
}

export function saveTheme(theme: Theme): void {
  applyTheme(theme);
  document.cookie = `${THEME_KEY}=${theme}; path=/; max-age=31536000; SameSite=Lax`;
  document.cookie = `${WORKSPACE_KEY}=1; path=/; max-age=31536000; SameSite=Lax`;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Private mode can refuse storage. The cookie still carries the choice.
  }
}

export function leaveWorkspaceTheme(): void {
  const root = document.documentElement;
  root.removeAttribute('data-product');
  root.classList.add('dark');
  document.cookie = `${WORKSPACE_KEY}=; path=/; max-age=0; SameSite=Lax`;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR.dark);
}

/**
 * Runs before paint. The workspace cookie is set once someone is inside the
 * signed-in shell, so the sign-in desk stays dark.
 */
export const THEME_SCRIPT = `(function(){try{if(!/(?:^|; )${WORKSPACE_KEY}=1/.test(document.cookie))return;var path=location.pathname;if(path!=="/workspace"&&path.indexOf("/workspace/")!==0)return;if(/\\/(forgot-password|reset-password|auth)(\\/|$)/.test(path)||/\\/login\\/?$/.test(path))return;document.documentElement.setAttribute("data-product","workspace");var m=document.cookie.match(/(?:^|; )${THEME_KEY}=(light|dark)/);var t=m?m[1]:null;try{t=t||localStorage.getItem("${THEME_KEY}")}catch(e){}if(t!=="dark"){document.documentElement.classList.remove("dark");var c=document.querySelector('meta[name="theme-color"]');if(c)c.setAttribute("content","${THEME_COLOR.light}")}}catch(e){}})()`;
