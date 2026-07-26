import {
  DOCUMENT_TYPE_LABEL,
  fieldText,
  formatChange,
  formatDate,
  formatPeriod,
  formatShortDate,
  formatValue,
  GAP_TEXT,
  isGap,
  milestoneLabel,
} from './format';
import type {
  BoundBlock,
  BoundField,
  DocumentPayload,
  DocumentSection,
  EffortRow,
  EvidenceRow,
  GrowthRow,
  MilestoneRow,
  ScopeRow,
} from './payload';

/**
 * Serialises a document to a self-contained HTML file for the client's Drive
 * Reports folder.
 *
 * This exists because rule 7 of the tracking specification requires a generated
 * report to be archived exactly as it was sent, and a reference into an
 * application is not an archive: the file has to stand on its own if Vistrial is
 * unavailable. It therefore carries its own stylesheet rather than depending on
 * the app's, and reads the same frozen payload the client's copy renders from, so
 * the two cannot disagree.
 */

const CSS = `
:root{--p:#6650d8;--deep:#241d49;--ink:#17161f;--muted:#5d5a6b;--faint:#918da2;--rule:#e6e3ef;--soft:#f4f1ff}
*{box-sizing:border-box}
body{margin:0;background:#fff;color:var(--ink);font:10.5pt/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,Arial,sans-serif}
.sheet{max-width:190mm;margin:0 auto;padding:16mm 4mm 20mm}
h1,h2,h3{color:var(--deep);letter-spacing:-.018em;margin:0}
.type{font-size:8.5pt;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--p)}
.cover{border-bottom:2px solid var(--p);padding-bottom:10mm}
.cover h1{font-size:26pt;line-height:1.08;margin-top:6mm}
.cover h2{font-size:15pt;font-weight:600;color:var(--ink);margin-top:7mm}
.period{margin-top:3mm;font-size:10pt;color:var(--muted)}
.producer{margin-top:9mm;display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap}
.producer strong{display:block;font-size:9.5pt;color:var(--deep)}
.producer span{font-size:8pt;color:var(--faint)}
.version{font-size:8pt;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--p)}
.callout{border-left:4px solid var(--p);background:var(--soft);padding:.85rem 1.1rem;margin-top:7mm}
.callout .k{font-size:8pt;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--p)}
section{margin-top:11mm;page-break-inside:avoid}
.st{margin:0 0 1.1rem;padding-bottom:.45rem;border-bottom:2px solid var(--p);font-size:8.5pt;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--p)}
p{margin:0 0 .7em}
table{width:100%;border-collapse:collapse;font-size:9.5pt}
th{background:var(--deep);color:#fff;font-size:8pt;font-weight:600;letter-spacing:.09em;text-transform:uppercase;text-align:left;padding:.5rem .7rem}
td{border-bottom:1px solid var(--rule);padding:.48rem .7rem;vertical-align:top}
tbody tr:nth-child(even){background:#faf9fe}
.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.gap{color:var(--faint);font-style:italic}
.up{color:#2f7d5c;font-weight:600}
.down{color:#b4443f;font-weight:600}
.note{font-size:8pt;color:var(--faint);display:block}
.summary{margin-top:4mm;font-size:8.5pt;color:var(--muted)}
ol.timeline{list-style:none;margin:0;padding:0}
ol.timeline li{display:flex;gap:1rem;margin-bottom:4mm}
ol.timeline .when{width:26mm;flex:0 0 26mm;font-size:8.5pt;font-weight:600;color:var(--p)}
ol.timeline .what{border-left:2px solid #ddd5fb;padding-left:1rem}
ol.timeline .what b{display:block;font-size:9.5pt;color:var(--deep)}
ol.timeline .what em{display:block;font-size:8pt;letter-spacing:.1em;text-transform:uppercase;color:var(--faint);font-style:normal}
footer{margin-top:14mm;padding-top:2mm;border-top:1px solid var(--rule);display:flex;justify-content:space-between;gap:1rem;font-size:7.5pt;color:var(--muted)}
@page{size:A4;margin:22mm 16mm}
@media print{.sheet{padding:0}}
`;

const escape = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const cell = (field: BoundField) =>
  `<td class="num${isGap(field) ? ' gap' : ''}">${escape(fieldText(field))}</td>`;

export function serialiseDocument(payload: DocumentPayload): string {
  const { document: doc, client, producer_line: producerLine } = payload;
  const period = formatPeriod(doc.period_start, doc.period_end);
  const generatedOn = formatDate(doc.published_at ?? doc.generated_at);
  const sections = [...payload.sections].sort((a, b) => a.sort_order - b.sort_order);

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(client.name)} · ${escape(doc.title)}</title>
<style>${CSS}</style></head>
<body><div class="sheet">
<header class="cover">
<p class="type">${escape(DOCUMENT_TYPE_LABEL[doc.type] ?? doc.type)}</p>
<h1>${escape(client.name)}</h1>
<h2>${escape(doc.title)}</h2>
${period ? `<p class="period">Period covered: ${escape(period)}</p>` : ''}
<div class="producer">
  <div><strong>${escape(producerLine)}</strong><span>Generated ${escape(generatedOn)}</span></div>
  ${doc.version > 1 ? `<p class="version">Version ${doc.version}</p>` : ''}
</div>
${
  doc.correction_note
    ? `<div class="callout"><p class="k">Correction, version ${doc.version}</p><p>${escape(doc.correction_note)}</p></div>`
    : ''
}
</header>
${sections.map(sectionHtml).join('\n')}
<footer><span>${escape(producerLine)}</span><span>Generated ${escape(generatedOn)}</span></footer>
</div></body></html>`;
}

function sectionHtml(section: DocumentSection): string {
  return `<section><h3 class="st">${escape(section.title)}</h3>${bodyHtml(section)}</section>`;
}

function bodyHtml(section: DocumentSection): string {
  const block = section.bound_data;

  switch (section.kind) {
    case 'fixed':
    case 'narrative':
      return section.body
        ? section.body
            .split(/\n{2,}/)
            .map((paragraph) => `<p>${escape(paragraph.trim())}</p>`)
            .join('')
        : `<p class="gap">${section.kind === 'narrative' ? 'This section has not been written yet.' : GAP_TEXT}</p>`;
    case 'bound_metrics':
      return metricsHtml(block);
    case 'bound_table':
      return tableHtml(block);
    case 'milestones':
      return milestonesHtml(block);
    case 'effort':
      return effortHtml(block);
    case 'evidence':
      return evidenceHtml(block);
    case 'scope':
      return scopeHtml(block);
    default:
      return '';
  }
}

function metricsHtml(block: BoundBlock | null): string {
  const rows = (block?.rows ?? []) as (GrowthRow | BoundField)[];
  if (rows.length === 0) return noData();

  if (!('baseline' in (rows[0] as GrowthRow))) {
    const fields = rows as BoundField[];
    return (
      `<table><thead><tr><th>Measure</th><th class="num">Value</th><th>How it was measured</th></tr></thead><tbody>` +
      fields
        .map(
          (field) =>
            `<tr><td>${escape(field.label)}</td>${cell(field)}<td${field.measurement ? '' : ' class="gap"'}>${escape(
              field.measurement ?? GAP_TEXT,
            )}${field.measurement_note ? `<span class="note">${escape(field.measurement_note)}</span>` : ''}</td></tr>`,
        )
        .join('') +
      `</tbody></table>` +
      leadSourcesHtml(block) +
      toolingHtml(block)
    );
  }

  const growth = rows as GrowthRow[];
  const improved = growth.filter((row) => row.improved === true).length;
  const worse = growth.filter((row) => row.improved === false).length;

  return (
    `<table><thead><tr><th>Measure</th><th class="num">At baseline</th><th class="num">Now</th><th class="num">Change</th></tr></thead><tbody>` +
    growth
      .map((row) => {
        const tone = row.absolute_change === null ? 'gap' : row.improved === false ? 'down' : row.improved ? 'up' : '';
        return `<tr><td>${escape(row.label)}</td>${cell(row.baseline)}${cell(row.current)}<td class="num ${tone}">${escape(
          formatChange(row.absolute_change, row.percent_change, row.unit),
        )}</td></tr>`;
      })
      .join('') +
    `</tbody></table>` +
    // Metrics that improved and metrics that did not are both shown.
    `<p class="summary">${improved} measure${improved === 1 ? '' : 's'} improved against the baseline, ${
      worse === 0 ? 'and none moved the wrong way' : `${worse} moved the wrong way`
    }.${block?.as_at ? ` Current figures as at ${escape(formatShortDate(block.as_at))}.` : ''}</p>`
  );
}

function tableHtml(block: BoundBlock | null): string {
  const rows = (block?.rows ?? []) as Record<string, unknown>[];
  if (rows.length === 0) return block?.metrics ? trajectoryHtml(block) : noData();

  const first = rows[0];

  if (typeof first?.status === 'string' || typeof first?.label === 'string') {
    const fields = rows as unknown as BoundField[];
    return (
      `<table><thead><tr><th>Measure</th><th class="num">Value</th><th>Source</th></tr></thead><tbody>` +
      fields
        .map(
          (field) =>
            `<tr><td>${escape(field.label)}${field.note ? `<span class="note">${escape(field.note)}</span>` : ''}</td>${cell(
              field,
            )}<td>${escape(field.source ?? GAP_TEXT)}</td></tr>`,
        )
        .join('') +
      `</tbody></table>`
    );
  }

  if (typeof first?.category === 'string') {
    const folders = rows as unknown as { category: string; url: string | null }[];
    return (
      `<table><thead><tr><th>Where</th><th>What is there</th></tr></thead><tbody>` +
      folders
        .map(
          (folder) =>
            `<tr><td>${escape(folder.category.replace(/_/g, ' '))}</td><td>${
              folder.url
                ? `<a href="${escape(folder.url)}">Open in Google Drive</a>`
                : `<span class="gap">${GAP_TEXT}</span>`
            }</td></tr>`,
        )
        .join('') +
      `</tbody></table>`
    );
  }

  if (typeof first?.title === 'string') {
    const components = rows as unknown as { title: string; description: string | null; occurred_on: string }[];
    return (
      `<table><thead><tr><th>Component</th><th>What it does</th><th class="num">Live since</th></tr></thead><tbody>` +
      components
        .map(
          (component) =>
            `<tr><td><b>${escape(component.title)}</b></td><td${component.description ? '' : ' class="gap"'}>${escape(
              component.description ?? GAP_TEXT,
            )}</td><td class="num">${escape(formatShortDate(component.occurred_on))}</td></tr>`,
        )
        .join('') +
      `</tbody></table>`
    );
  }

  return noData();
}

/** The arc, as a table rather than bars: an archived file has to survive plain text. */
function trajectoryHtml(block: BoundBlock): string {
  const metrics = (block.metrics ?? []).filter((metric) => metric.points.length > 1);
  if (metrics.length === 0) return noData();

  return (
    `<table><thead><tr><th>Measure</th><th class="num">Baseline</th><th class="num">Latest</th><th class="num">Readings</th></tr></thead><tbody>` +
    metrics
      .map((metric) => {
        const first = metric.points[0];
        const last = metric.points[metric.points.length - 1];
        return `<tr><td>${escape(metric.label)}</td><td class="num">${escape(
          formatValue(first.value, metric.unit),
        )}</td><td class="num">${escape(formatValue(last.value, metric.unit))}</td><td class="num">${
          metric.points.length
        }</td></tr>`;
      })
      .join('') +
    `</tbody></table>`
  );
}

function leadSourcesHtml(block: BoundBlock | null): string {
  const sources = block?.lead_sources ?? [];
  if (sources.length === 0) return '';
  return (
    `<p class="summary">By source, per month</p><table><thead><tr><th>Source</th><th class="num">Leads per month</th></tr></thead><tbody>` +
    sources.map((source) => `<tr><td>${escape(source.label)}</td>${cell(source)}</tr>`).join('') +
    `</tbody></table>`
  );
}

function toolingHtml(block: BoundBlock | null): string {
  const tooling = block?.tooling ?? [];
  if (tooling.length === 0) return '';
  return `<p class="summary"><b>Tools in place at capture:</b> ${escape(tooling.join(', '))}.</p>`;
}

function milestonesHtml(block: BoundBlock | null): string {
  const rows = (block?.rows ?? []) as MilestoneRow[];
  if (rows.length === 0) return noData('No milestones fall inside this period.');

  return (
    `<ol class="timeline">` +
    rows
      .map(
        (milestone) =>
          `<li><div class="when">${escape(formatShortDate(milestone.occurred_on))}</div><div class="what"><b>${escape(
            milestone.title,
          )}</b><em>${escape(milestoneLabel(milestone.type))}</em>${
            milestone.description ? `<p>${escape(milestone.description)}</p>` : ''
          }</div></li>`,
      )
      .join('') +
    `</ol>`
  );
}

function effortHtml(block: BoundBlock | null): string {
  if (block?.withheld) return noData('The work log was not included in this report.');
  const rows = (block?.rows ?? []) as EffortRow[];
  if (rows.length === 0) return noData('No work was logged inside this period.');

  return (
    `<table><thead><tr><th>Date</th><th>Phase</th><th>What was done</th></tr></thead><tbody>` +
    rows
      .map(
        (entry) =>
          `<tr><td class="num">${escape(formatShortDate(entry.performed_on))}</td><td${
            entry.phase ? '' : ' class="gap"'
          }>${escape(entry.phase ?? GAP_TEXT)}</td><td>${escape(entry.description)}</td></tr>`,
      )
      .join('') +
    `</tbody></table>`
  );
}

function evidenceHtml(block: BoundBlock | null): string {
  const rows = (block?.rows ?? []) as EvidenceRow[];
  if (rows.length === 0) return noData('No evidence was selected for this report.');

  return (
    `<table><thead><tr><th>Happened</th><th>What it proves</th><th>File</th></tr></thead><tbody>` +
    rows
      .map(
        (item) =>
          `<tr><td class="num">${escape(formatShortDate(item.happened_on))}</td><td${
            item.what_it_proves ? '' : ' class="gap"'
          }>${escape(item.what_it_proves ?? GAP_TEXT)}</td><td>${escape(item.filename)}</td></tr>`,
      )
      .join('') +
    `</tbody></table>`
  );
}

function scopeHtml(block: BoundBlock | null): string {
  const rows = (block?.rows ?? []) as ScopeRow[];
  const terms = block?.terms ?? [];
  if (rows.length === 0 && terms.length === 0) return noData();

  const requests =
    rows.length === 0
      ? ''
      : `<table><thead><tr><th>Requested</th><th>Request</th><th>Position</th><th class="num">Quoted</th></tr></thead><tbody>` +
        rows
          .map((request) => {
            const quote = request.quotes[request.quotes.length - 1];
            return `<tr><td class="num">${escape(formatShortDate(request.requested_on))}</td><td>${escape(
              request.summary,
            )}</td><td>${
              request.verdict === 'in_scope' ? 'Included in the engagement' : 'Outside the engagement'
            }</td><td class="num${quote?.amount ? '' : ' gap'}">${escape(
              quote?.amount ? formatValue(quote.amount, 'currency') : 'Not quoted',
            )}</td></tr>`;
          })
          .join('') +
        `</tbody></table>`;

  const termsTable =
    terms.length === 0
      ? ''
      : `<table><thead><tr><th>Term</th><th class="num">Value</th></tr></thead><tbody>` +
        terms.map((term) => `<tr><td>${escape(term.label)}</td>${cell(term)}</tr>`).join('') +
        `</tbody></table>`;

  return requests + termsTable;
}

const noData = (detail = 'This data was not captured.') => `<p class="gap">${escape(detail)}</p>`;
