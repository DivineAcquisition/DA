import { appUrl } from '@/lib/apps';
import { renderEmailHtml, textFooter } from '@/lib/email/layout';
import type { EmailPurpose } from '@/lib/email/policy';

type Payload = Record<string, unknown>;

function text(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function letter(input: { purpose: EmailPurpose; subject: string; title: string; paragraphs: string[]; href?: string; label?: string; reason: string }) {
  const footer = { reason: input.reason };
  return {
    purpose: input.purpose,
    subject: input.subject,
    html: renderEmailHtml({
      subject: input.subject,
      preheader: input.paragraphs[0] ?? input.title,
      eyebrow: 'Divine Acquisition',
      title: input.title,
      paragraphs: input.paragraphs,
      cta: input.href && input.label ? { href: input.href, label: input.label } : null,
      showFallbackLink: Boolean(input.href),
      footer,
    }),
    text: [input.title, '', ...input.paragraphs, '', input.href && input.label ? `${input.label}: ${input.href}` : '', '', ...textFooter(footer)]
      .filter((line) => line !== '')
      .join('\n'),
  };
}

/** The letter for one queued placement job. The job kind is the template name. */
export function placementLetter(kind: string, payload: Payload) {
  const name = text(payload.name) || text(payload.operator) || 'there';
  const client = text(payload.client) || 'the client';
  const start = text(payload.start);
  const shift = text(payload.shift);
  const zone = text(payload.zone);
  const workspace = `${appUrl('team')}/workspace/operator/client`;

  if (kind === 'operator.placement_assigned') {
    return letter({
      purpose: 'team',
      subject: `You are placed with ${client}`,
      title: `${name}, you are placed with ${client}`,
      paragraphs: [
        `Your placement starts ${start}.`,
        `Shift: ${shift} ${zone}.`,
        'Your client card has the offer, the booking rules, and what counts as a win. Read it before the first conversation.',
      ],
      href: workspace,
      label: 'Open your client card',
      reason: `You received this because Divine Acquisition placed you with ${client}.`,
    });
  }
  if (kind === 'operator.first_shift_reminder') {
    return letter({
      purpose: 'team',
      subject: `Your first shift with ${client} is ${start}`,
      title: 'Your first shift is coming up',
      paragraphs: [
        `${name}, your first shift with ${client} is ${start}, ${shift} ${zone}.`,
        'Sign in to their GHL with your own user, read the offer brief, and submit your end of day by the deadline.',
      ],
      href: workspace,
      label: 'Open your workspace',
      reason: `You received this because your first shift with ${client} is on ${start}.`,
    });
  }
  if (kind === 'client.operator_introduction') {
    return letter({
      purpose: 'client',
      subject: `${name} is your Divine Acquisition operator`,
      title: `${name} is starting with you`,
      paragraphs: [
        `${name} is the Sales Operator Divine Acquisition is placing with ${client}.`,
        start ? `The first shift is ${start}.` : 'The first shift date is on the placement.',
        'They work from the offer and booking rules your account manager confirmed. Questions go to your account manager, not to a shared login.',
      ],
      reason: `You received this because Divine Acquisition is introducing an operator for ${client}.`,
    });
  }
  if (kind === 'alerts.manager_activated') {
    return letter({
      purpose: 'alerts',
      subject: `${text(payload.manager)} activated ${name} at ${client}`,
      title: 'A manager activated a placement',
      paragraphs: [
        `${text(payload.manager)} activated the placement of ${name} with ${client}.`,
        'The launch checklist was met with nothing waived.',
      ],
      reason: 'You received this because a manager activated a placement.',
    });
  }
  if (kind === 'operator.placement_paused') {
    return letter({
      purpose: 'team',
      subject: `Your placement with ${client} is paused`,
      title: 'This placement is paused',
      paragraphs: [
        `${name}, your placement with ${client} is paused.`,
        text(payload.reason) ? `Reason: ${text(payload.reason)}` : '',
        text(payload.return_on) ? `Expected return: ${text(payload.return_on)}.` : '',
        'End of day reports stop until it resumes.',
      ].filter(Boolean),
      reason: `You received this because your placement with ${client} was paused.`,
    });
  }
  if (kind === 'client.placement_paused') {
    return letter({
      purpose: 'client',
      subject: `The operator for ${client} is paused`,
      title: 'The placement is paused',
      paragraphs: [
        `${text(payload.operator) || 'Your operator'} is paused for ${client}.`,
        text(payload.return_on) ? `The expected return date is ${text(payload.return_on)}.` : 'Your account manager has the expected return date.',
        'Weekly reports pause with the placement.',
      ],
      reason: `You received this because the placement for ${client} was paused and your account manager chose to tell you.`,
    });
  }
  if (kind.startsWith('alert.launch_health')) {
    const failed = Array.isArray(payload.results)
      ? payload.results
          .filter((item) => item && typeof item === 'object' && (item as { result?: string }).result === 'fail' && !(item as { admin_only?: boolean }).admin_only)
          .map((item) => (item as { reason?: string }).reason)
          .filter(Boolean)
      : [];
    return letter({
      purpose: 'alerts',
      subject: `Health check failed for ${name} at ${client}`,
      title: 'A launch health check failed',
      paragraphs: [`${name} on ${client} failed the launch health check.`, ...failed.map(String)],
      reason: 'You received this because a launch health check failed.',
    });
  }
  if (kind.startsWith('alert.launch_day_summary')) {
    const lines = [
      `Day ${text(payload.day)} for ${name} on ${client}.`,
      `EOD: ${text(payload.eod) || 'Not opened'}.`,
      `Health check: ${text(payload.health) || 'Not run'}.`,
      payload.needs_help ? 'The operator asked for help.' : 'No needs-help flag today.',
    ];
    if (payload.admin) lines.push(`Open first-week mismatches: ${text(payload.mismatches) || '0'}.`);
    return letter({
      purpose: 'alerts',
      subject: `Launch day ${text(payload.day)}: ${name} at ${client}`,
      title: 'Launch day summary',
      paragraphs: lines,
      reason: `You received this because launch summaries are on for ${client}.`,
    });
  }
  if (kind === 'operator.placement_ended') {
    return letter({
      purpose: 'team',
      subject: `Your placement with ${client} has ended`,
      title: 'This placement has ended',
      paragraphs: [
        `${name}, your placement with ${client} ends on ${text(payload.last_day)}.`,
        text(payload.reason) ? `Reason: ${text(payload.reason)}` : '',
        'The last client report covers through that day. Do not keep using that client’s GHL user after the last day.',
      ].filter(Boolean),
      reason: `You received this because your placement with ${client} ended.`,
    });
  }
  return letter({
    purpose: 'team',
    subject: 'A placement update',
    title: 'A placement update',
    paragraphs: ['A placement changed. Open the workspace for the detail.'],
    reason: 'You received this because a placement you are on changed.',
  });
}
