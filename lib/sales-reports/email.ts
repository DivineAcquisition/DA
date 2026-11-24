import { renderEmailHtml, textFooter } from '@/lib/email/layout';
import { asClientReport, focusLabel, formatValue, paceLabel, periodLabel, reportedLabel, reportSubject } from './client';

export function buildClientReportEmail(
  input: unknown,
  links: { reportUrl: string | null; replyTo?: string | null },
): { subject: string; html: string; text: string } {
  const report = asClientReport(input);
  const subject = reportSubject(report);
  const lines = report.headline.slice(0, 5).map((item) => {
    const target = item.target != null ? ` of ${formatValue(item.target)}` : '';
    const pace = paceLabel(item.pace);
    const source = reportedLabel(item.reported);
    return `${item.label}: ${formatValue(item.value)}${target}${pace ? `, ${pace}` : ''}${source ? `, ${source}` : ''}`;
  });
  const summary = report.summary ?? '';
  const focus = report.next_focus
    ? report.kind === 'biweekly'
      ? `${focusLabel(report.kind)}:\n${report.next_focus}`
      : `${focusLabel(report.kind)}: ${report.next_focus}`
    : '';
  const intro = `${report.operator}, ${report.role}. ${periodLabel(report)}.`;
  const footer = {
    reason: `You received this because Divine Acquisition sends the ${report.client} report.`,
    replyTo: links.replyTo,
  };
  const text = [
    report.test ? 'TEST' : '',
    report.client,
    intro,
    '',
    ...lines,
    '',
    summary,
    focus,
    links.reportUrl ? `View the report: ${links.reportUrl}` : '',
    ...textFooter(footer),
  ].filter(Boolean).join('\n');

  const html = renderEmailHtml({
    subject,
    preheader: lines[0] ?? subject,
    eyebrow: report.test ? 'Test report' : 'Client report',
    title: report.client,
    paragraphs: [intro, ...lines, summary, focus].filter(Boolean),
    cta: links.reportUrl ? { href: links.reportUrl, label: 'View full report' } : null,
    showFallbackLink: Boolean(links.reportUrl),
    footer,
  });

  return { subject, html, text };
}
