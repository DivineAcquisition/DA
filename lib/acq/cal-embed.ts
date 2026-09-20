/** Height + origin helpers for the Cal.com inline embed on /practices. */

export function isCalOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    return host === 'cal.com' || host === 'app.cal.com' || host.endsWith('.cal.com');
  } catch {
    return false;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function positiveHeight(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return Math.ceil(value);
}

/**
 * Cal posts height as CustomEvent.detail.data.iframeHeight, postMessage.arg,
 * or a flat iframeHeight / height field.
 */
export function readCalIframeHeight(event: unknown): number | null {
  const record = asRecord(event);
  if (!record) return null;

  const detail = asRecord(record.detail);
  const nestedDetail = asRecord(detail?.data);
  const nestedData = asRecord(record.data);
  const nestedArg = asRecord(record.arg);

  for (const candidate of [record, nestedArg, nestedData, detail, nestedDetail]) {
    if (!candidate) continue;
    const height = positiveHeight(candidate.iframeHeight) ?? positiveHeight(candidate.height);
    if (height) return height;
  }

  return null;
}

export function applyCalIframeHeight(host: HTMLElement, height?: number): number | null {
  const iframe = host.querySelector('iframe');
  if (!(iframe instanceof HTMLIFrameElement)) return null;

  const current = parseFloat(iframe.style.height);
  const next =
    typeof height === 'number'
      ? positiveHeight(height)
      : Number.isFinite(current) && current > 0
        ? Math.ceil(current)
        : null;
  if (!next) return null;

  const px = `${next}px`;
  iframe.style.height = px;
  iframe.style.maxHeight = 'none';
  host.style.height = px;
  host.style.minHeight = '0px';
  host.dataset.calSized = 'true';

  const inline = host.querySelector('cal-inline');
  if (inline instanceof HTMLElement) {
    inline.style.height = px;
    inline.style.maxHeight = 'none';
  }

  return next;
}
