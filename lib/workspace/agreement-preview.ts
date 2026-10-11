import 'server-only';
import { loadAgreementPage } from './agreement-page';
import { getDocuSealTemplate } from './docuseal';
import { readDocuSealApiKey } from './docuseal-key';
import { loadSigningCatalogue } from './sign-agreement';

import { agreementPdfFilename, choosePreviewDocument, previewDocumentUrl } from './agreement-preview-url';

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
  const live = apiKey ? await getDocuSealTemplate(apiKey, catalogue.templateId).catch(() => null) : null;
  const templateName =
    live && live.ok && live.data.name?.trim() ? live.data.name.trim() : page.templateName;
  const rawDocs =
    live && live.ok
      ? (
          live.data as {
            documents?: Array<{ name?: string; url?: string }>;
          }
        ).documents ?? []
      : [];
  const docs = rawDocs
    .filter((doc): doc is { name?: string; url: string } => Boolean(doc.url))
    .map((doc) => ({ name: doc.name?.trim() || 'Agreement', url: doc.url }));
  const chosen = choosePreviewDocument(docs, templateName);
  const url = chosen ? previewDocumentUrl(chosen.url) : null;
  if (!url) return unavailable;

  const upstream = await fetch(url, { cache: 'no-store' }).catch(() => null);
  if (!upstream?.ok || !upstream.body) {
    return Response.json(
      { error: 'The agreement could not be loaded.' },
      { status: 502, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  const filename = agreementPdfFilename(templateName || chosen?.name || 'Agreement');
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
