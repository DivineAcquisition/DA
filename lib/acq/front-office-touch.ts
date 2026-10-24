import { cookies } from 'next/headers';
import { mergeAttribution, touchFromTracking, type Touch } from './application-attribution';
import type { NicheVisit } from './niche-tracking';

export type FrontOfficeTouch = {
  firstCampaign: string;
  lastCampaign: string;
  adName: string;
};

function readTouch(raw: string | undefined): Touch | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Touch>;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      source: String(parsed.source ?? ''),
      medium: String(parsed.medium ?? ''),
      campaign: String(parsed.campaign ?? ''),
      content: String(parsed.content ?? ''),
      term: String(parsed.term ?? ''),
      id: String(parsed.id ?? ''),
    };
  } catch {
    return null;
  }
}

function campaigns(first: Touch | null, last: Touch | null, tracking: NicheVisit): FrontOfficeTouch {
  const merged = mergeAttribution({ first, last }, touchFromTracking(tracking));
  const adName =
    merged.sourceAd && merged.sourceAd !== 'direct'
      ? merged.sourceAd
      : tracking.utm_content || '';
  return {
    firstCampaign: merged.first.campaign,
    lastCampaign: merged.last.campaign,
    adName,
  };
}

/** Remember the first campaign and refresh the last one when this visit has parameters. */
export async function rememberFrontOfficeTouch(tracking: NicheVisit): Promise<void> {
  try {
    const jar = await cookies();
    const incoming = touchFromTracking(tracking);
    const first = readTouch(jar.get('acq_ft')?.value);
    const last = readTouch(jar.get('acq_lt')?.value);
    const secure = process.env.NODE_ENV === 'production';
    const base = { httpOnly: true, sameSite: 'lax' as const, secure, path: '/', maxAge: 60 * 60 * 24 * 180 };
    if (!first && incoming) jar.set('acq_ft', JSON.stringify(incoming), base);
    if (!first && !incoming) {
      jar.set('acq_ft', JSON.stringify({ source: 'direct', medium: '', campaign: '', content: 'direct', term: '', id: '' }), base);
    }
    if (incoming) jar.set('acq_lt', JSON.stringify(incoming), base);
    else if (!last) {
      jar.set('acq_lt', JSON.stringify({ source: 'direct', medium: '', campaign: '', content: 'direct', term: '', id: '' }), base);
    }
  } catch {
    // Cookie writes are unavailable in some renders. The lead still keeps this visit.
  }
}

export async function readFrontOfficeTouch(tracking: NicheVisit): Promise<FrontOfficeTouch> {
  try {
    const jar = await cookies();
    return campaigns(readTouch(jar.get('acq_ft')?.value), readTouch(jar.get('acq_lt')?.value), tracking);
  } catch {
    return campaigns(null, null, tracking);
  }
}
