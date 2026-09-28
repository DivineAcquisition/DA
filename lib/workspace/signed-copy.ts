import { fetchSubmissionDocuments } from '@/lib/workspace/docuseal';
import { serviceClient } from '@/lib/workspace/db';

export type SignedCopy = {
  signed_document_url: string | null;
  docuseal_submission_id: string | null;
  template_name: string | null;
};

/**
 * Streams a signed agreement through this origin so the DocuSeal file URL never
 * reaches the browser. DocuSeal file links expire, so a stale one is refreshed
 * with the API key, which only the service role can read.
 */
export async function streamSignedCopy(copy: SignedCopy, disposition: 'inline' | 'attachment'): Promise<Response> {
  let upstream = copy.signed_document_url
    ? await fetch(copy.signed_document_url, { cache: 'no-store' }).catch(() => null)
    : null;

  if ((!upstream || !upstream.ok) && copy.docuseal_submission_id) {
    const key = process.env.DOCUSEAL_API_KEY?.trim() || (await settingsKey());
    const [fresh] = key ? await fetchSubmissionDocuments(key, copy.docuseal_submission_id) : [];
    if (fresh?.url) upstream = await fetch(fresh.url, { cache: 'no-store' }).catch(() => null);
  }

  if (!upstream?.ok || !upstream.body) {
    return Response.json({ error: 'Your signed copy is still being prepared. Try again in a minute.' }, { status: 503 });
  }

  const name = (copy.template_name ?? 'Agreement').replace(/[^\w.\- ]+/g, '').trim() || 'Agreement';
  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'application/pdf',
      'Content-Disposition': `${disposition}; filename="${name} - signed.pdf"`,
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

async function settingsKey(): Promise<string> {
  const hasServiceKey =
    Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) || Boolean(process.env.SUPABASE_SECRET_KEY?.trim());
  const client = hasServiceKey ? serviceClient() : null;
  if (!client) return '';
  const { data } = await client.from('da_settings').select('docuseal_api_key').eq('id', 1).maybeSingle();
  return String((data as { docuseal_api_key?: string } | null)?.docuseal_api_key ?? '').trim();
}
