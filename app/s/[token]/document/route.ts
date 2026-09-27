import { NextResponse } from 'next/server';
import { fetchSubmissionDocuments } from '@/lib/workspace/docuseal';
import { publicDaRpc } from '@/lib/workspace/resolve-signing';
import { serviceClient } from '@/lib/workspace/db';

export const dynamic = 'force-dynamic';

type SignedCopy = {
  signed_document_url: string | null;
  docuseal_submission_id: string | null;
  template_name: string | null;
};

/**
 * The signed copy, streamed through this origin so the DocuSeal file URL never
 * reaches the browser and mobile viewers render it. Only a completed
 * agreement's token gets anything.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const copy = await publicDaRpc<SignedCopy>('da_agreement_signed_copy', { p_token: token });
  if (!copy) {
    return NextResponse.json({ error: 'This document is not available.' }, { status: 404 });
  }

  let upstream = copy.signed_document_url
    ? await fetch(copy.signed_document_url, { cache: 'no-store' }).catch(() => null)
    : null;

  // DocuSeal file links can expire. Ask DocuSeal for a fresh one with the key
  // the service role can read; the public key cannot.
  if ((!upstream || !upstream.ok) && copy.docuseal_submission_id) {
    const key = process.env.DOCUSEAL_API_KEY?.trim() || (await settingsKey());
    const [fresh] = key ? await fetchSubmissionDocuments(key, copy.docuseal_submission_id) : [];
    if (fresh?.url) upstream = await fetch(fresh.url, { cache: 'no-store' }).catch(() => null);
  }

  if (!upstream?.ok || !upstream.body) {
    return NextResponse.json(
      { error: 'Your signed copy is still being prepared. Try again in a minute.' },
      { status: 503 },
    );
  }

  const name = (copy.template_name ?? 'Agreement').replace(/[^\w.\- ]+/g, '').trim() || 'Agreement';
  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'application/pdf',
      'Content-Disposition': `attachment; filename="${name} - signed.pdf"`,
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
