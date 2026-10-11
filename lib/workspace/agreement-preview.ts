import 'server-only';
import { loadAgreementPage } from './agreement-page';
import { fetchTemplateDocuments } from './docuseal';
import { readDocuSealApiKey } from './docuseal-key';
import { loadSigningCatalogue } from './sign-agreement';

import { agreementPdfFilename, previewDocumentUrl } from './agreement-preview-url';

/**
 * The agreement PDF, streamed through this origin. pdf.js cannot read
 * DocuSeal's file links (no CORS), and a cross-origin PDF frame is a blank
 * box on phones. Same pattern as Novara's /api/va/agreement.
 */
export async function streamAgreementPreview(token: string, client: string | null): Promise<Response> {
  const unavailable = Response.json(
    { error: 'This document is not available.' },
    { status: 404, headers: { 'Cache-Control': 'private, no-store' } },
  );

  const page = await loadAgreementPage(token, client);
  if (page.state !== 'open') return unavailable;

  const catalogue = await loadSigningCatalogue(token);
  if (!catalogue?.templateId) return unavailable;

  const apiKey = await readDocuSealApiKey();
  const docs = apiKey ? await fetchTemplateDocuments(apiKey, catalogue.templateId) : [];
  const url = previewDocumentUrl(docs[0]?.url ?? '');
  if (!url) return unavailable;

  const upstream = await fetch(url, { cache: 'no-store' }).catch(() => null);
  if (!upstream?.ok || !upstream.body) {
    return Response.json(
      { error: 'The agreement could not be loaded.' },
      { status: 502, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  const filename = agreementPdfFilename(page.templateName || docs[0]?.name || 'Agreement');
  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
