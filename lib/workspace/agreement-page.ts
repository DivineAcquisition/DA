import { renderMarkdown, renderTitle } from './markdown';
import { publicDaRpc } from './resolve-signing';
import { recipientVariableValues } from './tokens';

/**
 * The public agreement page (/s/<token>), one state at a time.
 *
 * Everything comes from da_agreement_page(), which returns only what this
 * agreement's page shows. Every failure is the same {"state":"invalid"}, so
 * nothing here can tell a guessed token from an expired one either.
 */

export type AgreementPageState =
  | { state: 'invalid' }
  | { state: 'declined' }
  | { state: 'superseded'; redirectToken: string | null }
  | {
      state: 'completed';
      recipientName: string;
      templateName: string;
      completedAt: string | null;
      hasSignedDocument: boolean;
      onboardingUrl: string | null;
    }
  | {
      state: 'open';
      status: 'sent' | 'viewed';
      recipientName: string;
      businessName: string | null;
      templateName: string;
      templateDescription: string | null;
      embedSrc: string | null;
      email: string;
      pages: Array<{ title: string; html: string }>;
    };

type RawPage = {
  state?: string;
  redirect_token?: string | null;
  status?: string;
  recipient_name?: string;
  recipient_type?: string;
  business_name?: string | null;
  email?: string;
  template_name?: string;
  template_description?: string | null;
  embed_src?: string | null;
  completed_at?: string | null;
  has_signed_document?: boolean;
  onboarding_url?: string | null;
  pages?: Array<{ title?: string; body_markdown?: string }>;
};

const INVALID: AgreementPageState = { state: 'invalid' };

/** DocuSeal's embed only loads from DocuSeal; anything else is not rendered. */
function safeEmbedSrc(src: string | null | undefined): string | null {
  if (!src) return null;
  try {
    const url = new URL(src);
    return url.protocol === 'https:' && /(^|\.)docuseal\.(com|co|eu)$/.test(url.hostname) ? src : null;
  } catch {
    return null;
  }
}

/** Only same-origin-style onboarding links are offered as the next step. */
function safeOnboardingUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

export async function loadAgreementPage(
  token: string,
  client: string | null,
): Promise<AgreementPageState> {
  const raw = await publicDaRpc<RawPage>('da_agreement_page', {
    p_token: token,
    p_client: client,
  });
  if (!raw?.state) return INVALID;

  switch (raw.state) {
    case 'declined':
      return { state: 'declined' };
    case 'superseded':
      return { state: 'superseded', redirectToken: raw.redirect_token ?? null };
    case 'completed':
      return {
        state: 'completed',
        recipientName: raw.recipient_name ?? '',
        templateName: raw.template_name ?? 'Agreement',
        completedAt: raw.completed_at ?? null,
        hasSignedDocument: Boolean(raw.has_signed_document),
        onboardingUrl: safeOnboardingUrl(raw.onboarding_url),
      };
    case 'open': {
      const values = recipientVariableValues({
        full_name: raw.recipient_name ?? '',
        email: raw.email ?? '',
        business_name: raw.business_name ?? null,
      });
      return {
        state: 'open',
        status: raw.status === 'viewed' ? 'viewed' : 'sent',
        recipientName: raw.recipient_name ?? '',
        businessName: raw.business_name ?? null,
        templateName: raw.template_name ?? 'Agreement',
        templateDescription: raw.template_description ?? null,
        embedSrc: safeEmbedSrc(raw.embed_src),
        email: raw.email ?? '',
        pages: (raw.pages ?? []).map((page) => ({
          title: renderTitle(page.title ?? '', values),
          html: renderMarkdown(page.body_markdown ?? '', values),
        })),
      };
    }
    default:
      return INVALID;
  }
}

/** The caller, for rate limiting. Vercel sets x-forwarded-for; the first hop is the client. */
export function clientFromHeaders(headers: Headers): string | null {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || headers.get('x-real-ip')?.trim() || null;
}
