import { describe, expect, it } from 'vitest';
import { assetCounts, EMAILS, EVENTS, NEW_DISCORD_IDS, NEW_EMAIL_IDS, SAMPLE_FIELDS, SMS } from './index';
import { DISCORD_ALERTS } from './discord';
import { planDelivery } from './deliver';
import { renderDiscord, renderEmail, renderSms } from './render';
import { certificateVerification } from './pages';
import { isQuietHours, nextWindow } from './rules';
import { inApp } from './inApp';

const waking = new Date('2026-10-12T14:00:00.000Z');
const quiet = new Date('2026-10-11T02:00:00.000Z');
const sundayMorning = new Date('2026-10-11T14:00:00.000Z');
const live = { testMode: false as const };

function rendered(id: string, config?: { testMode?: boolean }) {
  return renderEmail(id, SAMPLE_FIELDS, { config });
}

describe('academy communications library', () => {
  it('matches the asset counts', () => {
    const counts = assetCounts();
    expect(counts.hiringEmails).toBe(10);
    expect(counts.traineeEmails).toBe(29);
    expect(counts.clientEmails).toBe(4);
    expect(counts.internalEmails).toBe(9);
    expect(counts.securityEmails).toBe(7);
    expect(counts.discordChannelAlerts).toBe(36);
    expect(counts.discordSystemAlerts).toBe(1);
    expect(counts.sms).toBe(9);
    expect(counts.inAppGroups).toBe(13);
    expect(counts.securePages).toBe(3);
    expect(counts.standardBlocks).toBe(5);
    expect(EMAILS.some((template) => template.id === 'A04')).toBe(false);
    expect(EMAILS.some((template) => template.id === 'C03')).toBe(false);
    expect(EVENTS.find((event) => event.key === 'client_pulse_reminder')?.email).toBe('B28');
  });

  it('includes the new delivery events', () => {
    for (const id of NEW_EMAIL_IDS) {
      expect(EMAILS.some((template) => template.id === id)).toBe(true);
      expect(EVENTS.some((event) => event.email === id)).toBe(true);
    }
    for (const id of NEW_DISCORD_IDS) {
      expect(DISCORD_ALERTS.some((alert) => alert.id === id)).toBe(true);
      expect(EVENTS.some((event) => event.discord === id)).toBe(true);
    }
  });

  it('renders every email in html and plain text with the footer and one button', () => {
    for (const template of EMAILS) {
      const result = rendered(template.id);
      expect(result.ok, template.id).toBe(true);
      if (!result.ok) continue;
      expect(result.email.html, template.id).toContain('max-width:600px');
      expect(result.email.html, template.id).toContain('#6A00FF');
      expect(result.email.text, template.id).toContain('7404 Executive Place, Lanham, MD 20706');
      expect(result.email.html, template.id).toContain('7404 Executive Place, Lanham, MD 20706');
      expect(result.email.replyTo).toBe('academy@divineacquisition.io');
      expect(result.email.fromAddress).toBe('academy@divineacquisition.io');
      const leftovers = `${result.email.subject}\n${result.email.preheader}\n${result.email.text}`.match(/\[[^\]]+\]/g) ?? [];
      expect(leftovers.every((token) => token === '[DA Academy]'), `${template.id} ${leftovers.join(',')}`).toBe(true);
      expect(result.email.text.includes('!'), template.id).toBe(false);
      expect(result.email.text.includes('—'), template.id).toBe(false);
      expect(result.email.subject.length, result.email.subject).toBeLessThanOrEqual(55);
      expect(result.email.preheader.length, result.email.preheader).toBeLessThanOrEqual(90);
      const buttons = result.email.html.match(/bgcolor="#6A00FF"/g) ?? [];
      expect(buttons.length, template.id).toBeLessThanOrEqual(1);
      if (!template.subject.includes('[')) expect(template.subject.length).toBeLessThanOrEqual(55);
      if (!template.preheader.includes('[')) expect(template.preheader.length).toBeLessThanOrEqual(90);
    }
  });

  it('keeps personal mail from a named sender and internal subjects prefixed', () => {
    const welcome = rendered('B01');
    const access = rendered('B02');
    const hold = rendered('D01');
    expect(welcome.ok && welcome.email.fromName).toBe('Malik at Divine Acquisition');
    expect(access.ok && access.email.fromName).toBe('Divine Acquisition');
    expect(hold.ok && hold.email.subject.startsWith('[DA Academy]')).toBe(true);
    expect(hold.ok && hold.email.text).toContain('Internal. Do not forward.');
  });

  it('renders discord without contact details and sms under the opt-out rules', () => {
    for (const alert of DISCORD_ALERTS) {
      const result = renderDiscord(alert.id, SAMPLE_FIELDS);
      expect(result.ok, alert.id).toBe(true);
      if (!result.ok) continue;
      expect(result.text, alert.id).not.toMatch(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
      expect(result.text, alert.id).not.toMatch(/\[[A-Za-z][^\]]*\]/);
      expect(result.text.includes('!')).toBe(false);
    }
    const optIn = renderSms('S00', SAMPLE_FIELDS);
    const help = renderSms('S08', SAMPLE_FIELDS);
    const stopped = renderSms('S07', SAMPLE_FIELDS);
    expect(optIn.ok && optIn.text.length).toBeLessThanOrEqual(160);
    expect(optIn.ok && optIn.text).toContain('Reply STOP to opt out');
    expect(help.ok && help.text).toContain('STOP');
    expect(stopped.ok && stopped.text).toContain('unsubscribed');
  });

  it('shows only the public certificate fields', () => {
    const valid = certificateVerification('valid', SAMPLE_FIELDS);
    expect(valid.body).toBe('Amina Cole holds Level 1: Certified Operator (Med Spa). Granted Oct 11, 2026. Status: Valid.');
    expect(valid.body).not.toMatch(/score|attempt|note|flag|@/i);
    expect(valid.footer).toContain('academy@divineacquisition.io');
    expect(certificateVerification('revoked', SAMPLE_FIELDS).body).toBe('This certification is no longer valid.');
    expect(certificateVerification('not_found', SAMPLE_FIELDS).body).toContain('could not find');
  });

  it('holds nudges for quiet hours, caps, and closed people, and lets security mail through', () => {
    const nudge = planDelivery('inactive_24h', { fields: SAMPLE_FIELDS, now: quiet, config: live, agreementSigned: true, status: 'active' });
    expect('items' in nudge && nudge.items.find((item) => item.channel === 'email')).toMatchObject({ action: 'defer', reason: 'quiet_hours' });

    const day = planDelivery('inactive_24h', { fields: SAMPLE_FIELDS, now: waking, config: live, agreementSigned: true, status: 'active' });
    expect('items' in day && day.items.find((item) => item.channel === 'email')?.action).toBe('send');

    const capped = planDelivery('inactive_24h', {
      fields: SAMPLE_FIELDS,
      now: waking,
      config: live,
      agreementSigned: true,
      status: 'active',
      unansweredNudges: 3,
    });
    expect('items' in capped && capped.items.every((item) => item.reason === 'nudge_cap')).toBe(true);

    const held = planDelivery('inactive_24h', { fields: SAMPLE_FIELDS, now: waking, config: live, status: 'on_hold', agreementSigned: true });
    expect('items' in held && held.items[0]?.reason).toBe('not_nudgeable');

    const unsigned = planDelivery('inactive_24h', { fields: SAMPLE_FIELDS, now: waking, config: live, agreementSigned: false, status: 'active' });
    expect('items' in unsigned && unsigned.items[0]?.reason).toBe('not_nudgeable');

    const security = planDelivery('confirm_email', { fields: SAMPLE_FIELDS, now: quiet, config: live });
    expect('items' in security && security.items[0]).toMatchObject({ action: 'send', templateId: 'I01' });
    expect(isQuietHours(quiet, 'America/New_York')).toBe(true);
    expect(isQuietHours(waking, 'America/New_York')).toBe(false);
  });

  it('keeps test mode on the admin inbox, blocks SMS, and leaves client mail and module emails off', () => {
    const sent = planDelivery('access_open', { fields: SAMPLE_FIELDS, now: quiet });
    expect('items' in sent).toBe(true);
    if (!('items' in sent)) return;
    expect(sent.items.find((item) => item.channel === 'email')).toMatchObject({
      action: 'redirect',
      to: 'academy@divineacquisition.io',
    });
    expect(sent.items.find((item) => item.channel === 'discord')).toMatchObject({
      action: 'redirect',
      discord: { channel: 'academy-test' },
    });
    expect(sent.items.find((item) => item.channel === 'sms')).toMatchObject({ action: 'skip', reason: 'test_mode' });

    const moduleMail = planDelivery('module_complete', { fields: SAMPLE_FIELDS, now: waking });
    expect('items' in moduleMail && moduleMail.items.map((item) => item.reason)).toEqual(['show', 'module_complete_disabled']);

    const client = planDelivery('client_intro', { fields: SAMPLE_FIELDS, now: waking, config: live });
    expect('items' in client && client.items[0]?.reason).toBe('client_contact_disabled');

    const approvedClient = planDelivery('client_intro', {
      fields: SAMPLE_FIELDS,
      now: waking,
      config: { ...live, clientContactEnabled: true },
      clientContactEnabled: true,
    });
    expect('items' in approvedClient && approvedClient.items[0]?.action).toBe('send');

    const weekendClient = planDelivery('client_pulse', {
      fields: SAMPLE_FIELDS,
      now: quiet,
      config: { ...live, clientContactEnabled: true },
      clientContactEnabled: true,
    });
    expect('items' in weekendClient && weekendClient.items[0]?.reason).toBe('business_hours');
  });

  it('requires a person before release or revocation, and waits out the SMS window', () => {
    const release = planDelivery('hold_release', { fields: SAMPLE_FIELDS, now: waking, config: live });
    expect('items' in release && release.items.every((item) => item.reason === 'manual_approval')).toBe(true);

    const revoked = planDelivery('cert_revoked', { fields: SAMPLE_FIELDS, now: waking, config: live, approved: true });
    expect('items' in revoked && revoked.items.find((item) => item.channel === 'email')?.action).toBe('send');
    expect(revoked && 'items' in revoked && revoked.items.find((item) => item.email)?.email?.text).toContain('withdrawn');
    expect(revoked && 'items' in revoked && revoked.items.find((item) => item.email)?.email?.text).not.toMatch(/!|—/);

    const text = planDelivery('access_open', {
      fields: SAMPLE_FIELDS,
      now: sundayMorning,
      config: { ...live, smsEnabled: true },
      smsOptIn: true,
    });
    expect('items' in text && text.items.find((item) => item.channel === 'sms')).toMatchObject({ action: 'defer', reason: 'sms_window' });

    const weekday = planDelivery('access_open', {
      fields: SAMPLE_FIELDS,
      now: waking,
      config: { ...live, smsEnabled: true },
      smsOptIn: true,
    });
    expect('items' in weekday && weekday.items.find((item) => item.channel === 'sms')?.action).toBe('send');

    const internal = planDelivery('hold_assigned', { fields: SAMPLE_FIELDS, now: waking, config: live });
    expect('items' in internal && internal.items.find((item) => item.channel === 'email')?.reason).toBe('discord_primary');
    expect('items' in internal && internal.items.find((item) => item.channel === 'discord')?.action).toBe('send');

    const fallback = planDelivery('hold_assigned', { fields: SAMPLE_FIELDS, now: waking, config: live, emailFallback: true });
    expect('items' in fallback && fallback.items.find((item) => item.channel === 'email')?.action).toBe('send');
  });

  it('refuses a discord alert that contains an email address', () => {
    const leaked = renderDiscord('new_trainee', { ...SAMPLE_FIELDS, fullName: 'Amina Cole amina@example.com' });
    expect(leaked.ok).toBe(false);
    if (!leaked.ok) expect(leaked.violations).toContain('contact');
  });

  it('opens the next quiet-hours window at 7 AM local', () => {
    expect(nextWindow(quiet, 'America/New_York', 'waking').toISOString()).toBe('2026-10-11T11:00:00.000Z');
    expect(nextWindow(sundayMorning, 'America/New_York', 'sms').toISOString()).toBe('2026-10-12T11:00:00.000Z');
  });

  it('uses the in-app copy for the screens a trainee sees', () => {
    expect(inApp.signIn.headline).toBe('Sign in to the Academy');
    expect(inApp.signIn.wrongLogin).not.toMatch(/!/);
    expect(inApp.dashboard.stalled('Module 3: Lesson 2')).toContain('Pick up where you left off: Module 3: Lesson 2');
    expect(inApp.hold.acknowledge).toBe('I have read my plan');
    expect(inApp.quiz.attempt4).toContain('one attempt left');
    expect(inApp.system.notFound).toBe('That page does not exist. Go back to your dashboard.');
    expect(SMS.map((template) => template.id)).toEqual(['S00', 'S01', 'S02', 'S03', 'S04', 'S05', 'S06', 'S07', 'S08']);
  });
});
