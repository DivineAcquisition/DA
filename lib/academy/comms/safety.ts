export type OutboundChannel = 'email' | 'discord' | 'sms';

const SECRET = /discord\.com\/api\/webhooks|sk_live_|sk_test_|whsec_|-----BEGIN|api[_-]?key\s*[:=]/i;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE = /(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]\d{4}\b/;
const TRAINEE_SCORE = /\byou scored\b|\byour score\b|\breviewer notes?\b|\bintegrity flag\b/i;

export function safetyViolations(channel: OutboundChannel, text: string, templateId?: string): string[] {
  const violations: string[] = [];
  if (text.includes('!') || text.includes('—')) violations.push('voice');
  if (SECRET.test(text)) violations.push('secret');
  if (channel === 'discord' && (EMAIL.test(text) || PHONE.test(text))) violations.push('contact');
  const traineeFacing = channel !== 'discord' && !templateId?.startsWith('D') && !templateId?.startsWith('I');
  if (traineeFacing && TRAINEE_SCORE.test(text)) violations.push('score');
  if (channel === 'discord' && /\byou scored\b|\bfree text\b/i.test(text) && templateId !== 'low_simulation_score') {
    violations.push('score');
  }
  return violations;
}
