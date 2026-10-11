import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';

/**
 * pdf.js worker for the signing page. It lives under /s so the talent host
 * does not rewrite it into the assessment app (a root file comes back as HTML).
 */
export async function GET(): Promise<Response> {
  try {
    const file = path.join(process.cwd(), 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
    const body = await readFile(file);
    return new Response(body, {
      headers: {
        'Content-Type': 'text/javascript; charset=utf-8',
        'Cache-Control': 'public, max-age=86400',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  } catch (error) {
    console.error('[pdf-worker]', error instanceof Error ? error.message : error);
    return new Response('pdf.js worker is not available', { status: 404 });
  }
}
