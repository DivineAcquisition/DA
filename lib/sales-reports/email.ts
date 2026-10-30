import { asClientReport, formatValue, paceLabel, periodLabel, reportedLabel, reportSubject } from './client';

function row(label: string, value: string): string {
  return `<tr><td style="padding:8px 0;color:#5c5670;font-size:14px;">${escapeHtml(label)}</td><td style="padding:8px 0;text-align:right;font-weight:600;color:#1a1523;font-size:14px;">${escapeHtml(value)}</td></tr>`;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function buildClientReportEmail(input: unknown, links: { reportUrl: string | null }): { subject: string; html: string; text: string } {
  const report = asClientReport(input);
  const subject = reportSubject(report);
  const lines = report.headline.slice(0, 5).map((item) => {
    const target = item.target != null ? ` of ${formatValue(item.target)}` : '';
    const pace = paceLabel(item.pace);
    const source = reportedLabel(item.reported);
    return `${item.label}: ${formatValue(item.value)}${target}${pace ? `, ${pace}` : ''}${source ? `, ${source}` : ''}`;
  });
  const summary = report.summary ?? '';
  const text = [
    report.test ? 'TEST' : '',
    `${report.client}`,
    `${report.operator}, ${report.role}`,
    periodLabel(report),
    '',
    ...lines,
    '',
    summary,
    report.next_focus ? `Next focus: ${report.next_focus}` : '',
    links.reportUrl ? `View the report: ${links.reportUrl}` : '',
    'Devotion. Value. Exclusivity.',
  ].filter(Boolean).join('\n');

  const headlineRows = report.headline.slice(0, 5).map((item) => {
    const extra = [item.target != null ? `of ${formatValue(item.target)}` : '', paceLabel(item.pace), reportedLabel(item.reported)].filter(Boolean).join(' · ');
    return row(item.label, `${formatValue(item.value)}${extra ? ` ${extra}` : ''}`);
  }).join('');

  const button = links.reportUrl
    ? `<a href="${escapeHtml(links.reportUrl)}" style="display:inline-block;background:#6A00FF;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:10px;font-weight:600;">View full report</a>`
    : '';

  const html = `<!doctype html><html><body style="margin:0;background:#f6f4fb;font-family:Inter,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px;">
    <p style="margin:0 0 8px;color:#6A00FF;font-size:12px;letter-spacing:.14em;font-weight:700;">DIVINE ACQUISITION</p>
    ${report.test ? '<p style="margin:0 0 8px;color:#9b1c1c;font-weight:700;">TEST</p>' : ''}
    <h1 style="margin:0;font-size:28px;line-height:1.2;color:#1a1523;font-family:'Plus Jakarta Sans',Arial,sans-serif;">${escapeHtml(report.client)}</h1>
    <p style="margin:8px 0 0;color:#5c5670;">${escapeHtml(report.operator)}, ${escapeHtml(report.role)} · ${escapeHtml(periodLabel(report))}</p>
    <div style="margin-top:20px;background:#ffffff;border-radius:16px;padding:20px;">
      <table style="width:100%;border-collapse:collapse;">${headlineRows}</table>
      ${summary ? `<p style="margin:16px 0 0;color:#1a1523;font-size:15px;line-height:1.5;">${escapeHtml(summary)}</p>` : ''}
      ${report.next_focus ? `<p style="margin:12px 0 0;color:#5c5670;font-size:14px;">Next focus: ${escapeHtml(report.next_focus)}</p>` : ''}
      <p style="margin:20px 0 0;">${button}</p>
    </div>
    <p style="margin:16px 0 0;color:#8a8498;font-size:12px;">Devotion. Value. Exclusivity.</p>
  </div></body></html>`;

  return { subject, html, text };
}
