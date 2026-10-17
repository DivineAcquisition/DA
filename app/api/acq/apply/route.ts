import { cookies } from 'next/headers';
import { after, NextResponse } from 'next/server';
import { touchFromTracking } from '@/lib/acq/application-attribution';
import { publicShape } from '@/lib/acq/application-flow';
import { applyFlow, deliverCompletedApplication, readStoredTouch, rememberTouches } from '@/lib/acq/application-server';

export const dynamic = 'force-dynamic';

function clip(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function clientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip')?.trim() ||
    'local'
  );
}

function trackingOf(body: Record<string, unknown>): Record<string, string | undefined> {
  const tracking = body.tracking;
  if (!tracking || typeof tracking !== 'object') return {};
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(tracking)) {
    if (typeof value === 'string' && value.trim()) out[key] = value.trim();
  }
  return out;
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request.' }, { status: 400 });
  }

  const action = clip(body.action, 20);
  const jar = await cookies();
  const storedFirst = readStoredTouch(jar.get('acq_ft')?.value);
  const storedLast = readStoredTouch(jar.get('acq_lt')?.value);
  const incoming = touchFromTracking(trackingOf(body));
  const test = body.test === true;
  const adName = incoming?.content || storedFirst?.content || 'direct';

  try {
    if (action === 'touch') {
      await rememberTouches(incoming, storedFirst, storedLast);
      return NextResponse.json({ ok: true });
    }
    if (action === 'open') {
      const result = await applyFlow.open({ adName: adName === 'direct' ? 'direct' : adName, test, key: `open:${clientIp(request)}` });
      return NextResponse.json(result, { status: result.ok ? 200 : 429 });
    }
    if (action === 'start') {
      await rememberTouches(incoming, storedFirst, storedLast);
      const result = publicShape(
        await applyFlow.start({
          firstName: clip(body.firstName, 80),
          email: clip(body.email, 320),
          phone: clip(body.phone, 40),
          smsConsent: body.smsConsent === true,
          website: clip(body.website, 200),
          page: clip(body.page, 500),
          test,
          key: clientIp(request),
          incoming,
          storedFirst,
          storedLast,
        }),
      );
      if (result.ok) await applyFlow.retry();
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }
    if (action === 'answer') {
      const token = clip(body.token, 120);
      const result = publicShape(
        await applyFlow.answer({
          token,
          question: Number(body.question),
          value: clip(body.value, 80),
        }),
      );
      if (result.ok && result.screen) {
        after(() => {
          void deliverCompletedApplication(token).catch((error) => console.error('[acq:deliver]', error));
        });
      }
      if (result.ok) void applyFlow.retry();
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }
    if (action === 'resume') {
      const result = await applyFlow.resume(clip(body.token, 120));
      if (!result.ok) return NextResponse.json({ ok: false });
      return NextResponse.json({
        ok: true,
        question: result.question,
        answers: result.answers,
        screen: result.screen,
        firstName: result.firstName,
      });
    }
    if (action === 'book') {
      await applyFlow.book(clip(body.token, 120));
      return NextResponse.json({ ok: true });
    }
  } catch (error) {
    console.error('[acq:apply]', error);
    return NextResponse.json({ ok: false, error: 'We saved your place. Try that once more.' });
  }

  return NextResponse.json({ ok: false, error: 'Invalid request.' }, { status: 400 });
}
