export type AcademyPathKind = 'home' | 'modules' | 'module' | 'missing';

/** Which trainee screen a path is. Anything else is a not-found, including other apps. */
export function academyPathKind(pathname: string): AcademyPathKind {
  const path = pathname.split('?')[0].replace(/\/+$/, '') || '/';
  if (path === '/academy') return 'home';
  if (path === '/academy/modules') return 'modules';
  if (/^\/academy\/modules\/[^/]+$/.test(path)) return 'module';
  return 'missing';
}

export function moduleStatusLabel(display: string): string {
  switch (display) {
    case 'locked':
      return 'Locked';
    case 'available':
      return 'Available';
    case 'in_progress':
      return 'In progress';
    case 'complete':
      return 'Complete';
    case 'unpublished':
      return 'Not yet published';
    default:
      return 'Unavailable';
  }
}

/** Calendar dates from Postgres (`YYYY-MM-DD` or a timestamp) without a timezone shift. */
export function formatAcademyDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
