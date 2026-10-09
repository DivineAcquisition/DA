import type { NicheContent } from '@/lib/acq/niche-content';

export function Check() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden>
      <path d="m4 10 4 4 8-8" />
    </svg>
  );
}

export function ProblemIcon({ name }: { name: 'lead' | 'estimate' | 'inspection' }) {
  if (name === 'estimate') {
    return (
      <span className="niche-icon" aria-hidden>
        <svg viewBox="0 0 24 24">
          <path d="M8 3.5h6.2L19 8.2V20a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 7 20V5A1.5 1.5 0 0 1 8.5 3.5H8z" />
          <path d="M14 3.8V8h4.2M9 12h6M9 16h6" />
        </svg>
      </span>
    );
  }
  if (name === 'inspection') {
    return (
      <span className="niche-icon" aria-hidden>
        <svg viewBox="0 0 24 24">
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path d="M8 3.5v3M16 3.5v3M4 9.5h16M9 14.5l2 2 4-4" />
        </svg>
      </span>
    );
  }
  return (
    <span className="niche-icon" aria-hidden>
      <svg viewBox="0 0 24 24">
        <path d="M8 4.5h8l1.2 2.2H19a1.5 1.5 0 0 1 1.5 1.5V18a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2V8.2A1.5 1.5 0 0 1 5 6.7h1.8L8 4.5z" />
        <path d="M12 10.2v3.2M12 16.2h.01" />
      </svg>
    </span>
  );
}

export function NicheVideo({ video }: { video: NicheContent['video'] }) {
  const url = video.url.trim();
  if (!video.enabled || !url) return null;
  const embed = embedSrc(url);
  return (
    <div className="lx-video-wrap niche-video">
      <div className="lx-video-shell">
        {embed ? (
          <iframe
            src={embed}
            title="Short video"
            loading="lazy"
            allow="fullscreen; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <video controls preload="none" playsInline src={url} />
        )}
      </div>
    </div>
  );
}

function embedSrc(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = parsed.pathname.split('/').filter(Boolean)[0];
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const id = parsed.searchParams.get('v') || parsed.pathname.split('/').filter(Boolean).pop();
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (host === 'player.vimeo.com' || host === 'vimeo.com') {
      const id = parsed.pathname.split('/').filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
    if (host.endsWith('wistia.com') || host.endsWith('wistia.net')) return url;
    if (host === 'loom.com' || host.endsWith('.loom.com')) return url;
    return null;
  } catch {
    return null;
  }
}

export function NicheQuotes({ quotes }: { quotes: NicheContent['quotes'] }) {
  if (!quotes.enabled || quotes.items.length === 0) return null;
  return (
    <ul className="niche-places">
      {quotes.items.map((item) => (
        <li key={item.attribution} className="lx-card">
          <blockquote className="niche-body">&ldquo;{item.quote}&rdquo;</blockquote>
          <p>{item.attribution}</p>
        </li>
      ))}
    </ul>
  );
}
