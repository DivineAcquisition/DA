'use client';

// Renders every page of a same-origin PDF. A DocuSeal file frame is a blank
// box on phones; Novara's PdfViewer is this pattern.

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ExternalLink, Loader2 } from 'lucide-react';

type Props = {
  url: string;
  title?: string;
  className?: string;
  onError?: () => void;
};

export default function AgreementPdf({ url, title = 'Agreement', className, onError }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [pagesDone, setPagesDone] = useState(0);
  const [numPages, setNumPages] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    setState('loading');
    setPagesDone(0);
    setNumPages(0);

    const render = async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = '/s/pdf-worker';

        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) throw new Error(`preview ${response.status}`);
        const data = await response.arrayBuffer();
        const head = new TextDecoder().decode(data.slice(0, 5));
        if (head !== '%PDF-') throw new Error('preview is not a pdf');

        const doc = await pdfjs.getDocument({ data }).promise;
        if (cancelled) return;
        setNumPages(doc.numPages);

        const container = containerRef.current;
        if (!container) return;
        const cssWidth = container.clientWidth;
        if (cssWidth < 40) {
          attempts += 1;
          if (attempts > 20) {
            if (!cancelled) setState('error');
            return;
          }
          window.setTimeout(() => {
            if (!cancelled) void render();
          }, 50);
          return;
        }

        container.replaceChildren();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        for (let i = 1; i <= doc.numPages; i += 1) {
          const page = await doc.getPage(i);
          if (cancelled) return;
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: (cssWidth / base.width) * dpr });

          const canvas = document.createElement('canvas');
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = '100%';
          canvas.style.height = 'auto';
          canvas.style.display = 'block';
          canvas.setAttribute('role', 'img');
          canvas.setAttribute('aria-label', `${title}, page ${i} of ${doc.numPages}`);
          canvas.className = 'border-b border-black/10 bg-white last:border-b-0';
          container.appendChild(canvas);

          const ctx = canvas.getContext('2d');
          if (!ctx) continue;
          await page.render({ canvas, canvasContext: ctx, viewport }).promise;
          if (cancelled) return;
          setPagesDone(i);
        }
        if (!cancelled) setState('ready');
      } catch (error) {
        console.warn('[agreement-pdf]', error instanceof Error ? error.message : error);
        if (!cancelled) {
          setState('error');
          onError?.();
        }
      }
    };

    void render();
    return () => {
      cancelled = true;
    };
  }, [url, title, onError]);

  if (state === 'error') {
    return (
      <div className={className}>
        <div className="px-6 py-10 text-center">
          <AlertTriangle className="mx-auto h-5 w-5 text-amber-300" aria-hidden />
          <p className="mt-3 text-sm text-white/70">The agreement could not be shown on this device.</p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#c3b6fe] underline underline-offset-2"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            Open the agreement
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {state === 'loading' ? (
        <div className="flex items-center justify-center gap-2 py-8 text-xs text-white/45">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {numPages ? `Page ${Math.min(pagesDone + 1, numPages)} of ${numPages}` : 'Loading the agreement'}
        </div>
      ) : null}
      <div ref={containerRef} />
      {state === 'ready' && numPages > 0 ? (
        <p className="border-t border-white/10 py-2 text-center text-[10px] uppercase tracking-[0.16em] text-white/35">
          End of document · {numPages} {numPages === 1 ? 'page' : 'pages'}
        </p>
      ) : null}
    </div>
  );
}
