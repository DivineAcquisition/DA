export type AcademyPathKind = 'home' | 'modules' | 'module' | 'lesson' | 'quiz' | 'simulation' | 'drill' | 'reflection' | 'practical' | 'missing';

/** Which trainee screen a path is. Anything else is a not-found, including other apps. */
export function academyPathKind(pathname: string): AcademyPathKind {
  const path = pathname.split('?')[0].replace(/\/+$/, '') || '/';
  if (path === '/academy') return 'home';
  if (path === '/academy/modules') return 'modules';
  if (/^\/academy\/modules\/[^/]+\/lessons\/[^/]+$/.test(path)) return 'lesson';
  if (/^\/academy\/modules\/[^/]+\/quiz$/.test(path)) return 'quiz';
  if (/^\/academy\/modules\/[^/]+\/simulations\/[^/]+$/.test(path)) return 'simulation';
  if (/^\/academy\/modules\/[^/]+\/drill$/.test(path)) return 'drill';
  if (/^\/academy\/modules\/[^/]+\/reflection$/.test(path)) return 'reflection';
  if (/^\/academy\/modules\/[^/]+\/practical$/.test(path)) return 'practical';
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
    case 'lessons_complete':
      return 'Lessons complete, quiz not yet available';
    case 'quiz_available':
      return 'Quiz available';
    case 'quiz_passed_pending':
      return 'Quiz passed, additional requirement pending';
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
