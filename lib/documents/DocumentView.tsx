import Logo from '@/app/components/Logo';
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
  TrajectoryMetric,
} from './payload';

/**
 * The renderer. One component produces the admin's review preview, the copy in
 * the client's account, and the print output, because a preview that is not the
 * same code as the delivered document is not a preview.
 *
 * Branding rules live here:
 *  - the client is the subject and DA is the firm that produced it, so the cover
 *    leads with the client name and the report title and DA sits beneath;
 *  - the producer line and the generation date appear on every page;
 *  - Vistrial is named quietly in the producer line, never as the primary brand.
 */

export default function DocumentView({ payload }: { payload: DocumentPayload }) {
  const { document: doc, client, producer_line: producerLine } = payload;
  const period = formatPeriod(doc.period_start, doc.period_end);
  const sections = [...payload.sections].sort((a, b) => a.sort_order - b.sort_order);
  const generatedOn = formatDate(doc.published_at ?? doc.generated_at);

  return (
    <div className="doc mx-auto">
      {/* Repeats on every printed page. Pages get separated and forwarded. */}
      <RunningHeader clientName={client.name} title={doc.title} />

      <div className="doc-sheet border border-[#e6e3ef] px-[18mm] py-[16mm] shadow-[0_24px_60px_-40px_rgba(36,29,73,0.45)]">
        <Cover
          clientName={client.name}
          logoUrl={client.logo_url}
          title={doc.title}
          typeLabel={DOCUMENT_TYPE_LABEL[doc.type] ?? doc.type}
          period={period}
          producerLine={producerLine}
          generatedOn={generatedOn}
          version={doc.version}
          correctionNote={doc.correction_note}
          anonymised={client.anonymised}
          vertical={client.vertical}
        />

        <div className="mt-[14mm] space-y-[11mm]">
          {sections.map((section) => (
            <Section key={section.key} section={section} />
          ))}
        </div>
      </div>

      <RunningFooter producerLine={producerLine} generatedOn={generatedOn} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cover, running header, running footer
// ---------------------------------------------------------------------------

function Cover({
  clientName,
  logoUrl,
  title,
  typeLabel,
  period,
  producerLine,
  generatedOn,
  version,
  correctionNote,
  anonymised,
  vertical,
}: {
  clientName: string;
  logoUrl: string | null;
  title: string;
  typeLabel: string;
  period: string | null;
  producerLine: string;
  generatedOn: string;
  version: number;
  correctionNote: string | null;
  anonymised: boolean;
  vertical: string | null;
}) {
  return (
    <header className="doc-cover border-b-2 border-[#6650d8] pb-[10mm]">
      <p className="text-[8pt] font-semibold uppercase tracking-[0.18em] text-[#6650d8]">{typeLabel}</p>

      <div className="mt-[6mm] flex items-start gap-4">
        {/* Where the client has supplied a logo it sits alongside their name. */}
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="mt-1 h-[14mm] w-auto max-w-[38mm] object-contain" />
        )}
        <div className="min-w-0">
          <h1 className="text-[26pt] font-bold leading-[1.08] text-[#241d49]">{clientName}</h1>
          {anonymised && vertical && (
            <p className="mt-1 text-[9pt] italic text-[#918da2]">
              Identifying details replaced. Sector: {vertical}.
            </p>
          )}
        </div>
      </div>

      <h2 className="mt-[7mm] text-[15pt] font-semibold leading-tight text-[#17161f]">{title}</h2>

      {period && <p className="mt-[3mm] text-[10pt] text-[#5d5a6b]">Period covered: {period}</p>}

      <div className="mt-[9mm] flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <Logo markOnly tone="current" className="h-[11mm] w-auto text-[#241d49]" />
          <div>
            <p className="text-[9.5pt] font-semibold text-[#241d49]">{producerLine}</p>
            <p className="text-[8pt] text-[#918da2]">Generated {generatedOn}</p>
          </div>
        </div>
        {version > 1 && (
          <p className="text-[8pt] font-semibold uppercase tracking-[0.12em] text-[#6650d8]">
            Version {version}
          </p>
        )}
      </div>

      {/* Rule 4: a corrected version says so on its face. */}
      {correctionNote && (
        <div className="doc-callout mt-[7mm]">
          <p className="text-[8pt] font-bold uppercase tracking-[0.14em] text-[#6650d8]">
            Correction, version {version}
          </p>
          <p className="mt-1 text-[9.5pt] text-[#17161f]">{correctionNote}</p>
        </div>
      )}
    </header>
  );
}

function RunningHeader({ clientName, title }: { clientName: string; title: string }) {
  return (
    <div className="doc-running doc-running-header flex items-center justify-between gap-4 border-b pb-1.5">
      <span className="truncate font-semibold uppercase tracking-[0.1em]">{clientName}</span>
      <span className="truncate">{title}</span>
    </div>
  );
}

function RunningFooter({ producerLine, generatedOn }: { producerLine: string; generatedOn: string }) {
  return (
    <div className="doc-running doc-running-footer mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-1.5">
      <span>{producerLine}</span>
      <span>
        Page <span className="doc-page-number" /> · Generated {generatedOn}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function Section({ section }: { section: DocumentSection }) {
  return (
    <section className="doc-section">
      <h3 className="doc-section-title">{section.title}</h3>
      <SectionBody section={section} />
    </section>
  );
}

function SectionBody({ section }: { section: DocumentSection }) {
  switch (section.kind) {
    case 'fixed':
    case 'narrative':
      return <Prose body={section.body} kind={section.kind} />;
    case 'bound_metrics':
      return <BoundMetrics block={section.bound_data} />;
    case 'bound_table':
      return <BoundTable block={section.bound_data} />;
    case 'milestones':
      return <Milestones block={section.bound_data} />;
    case 'effort':
      return <Effort block={section.bound_data} />;
    case 'evidence':
      return <Evidence block={section.bound_data} />;
    case 'scope':
      return <Scope block={section.bound_data} />;
    default:
      return null;
  }
}

function Prose({ body, kind }: { body: string | null; kind: 'fixed' | 'narrative' }) {
  if (!body) {
    return (
      <p className="doc-gap text-[9.5pt]">
        {kind === 'narrative' ? 'This section has not been written yet.' : GAP_TEXT}
      </p>
    );
  }
  return (
    <div>
      {body.split(/\n{2,}/).map((paragraph, index) => (
        <p key={index}>{paragraph.trim()}</p>
      ))}
    </div>
  );
}

/** Baseline against current, for every metric the engagement is judged on. */
function BoundMetrics({ block }: { block: BoundBlock | null }) {
  const rows = (block?.rows ?? []) as (GrowthRow | BoundField)[];
  if (rows.length === 0) return <NoData />;

  // The audit report's baseline block and the growth block share this section
  // kind: one is a flat list of captured figures, the other is a comparison.
  const isComparison = rows.length > 0 && 'baseline' in (rows[0] as GrowthRow);

  if (!isComparison) {
    const fields = rows as BoundField[];
    return (
      <>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Measure</th>
              <th className="doc-num">Value</th>
              <th style={{ width: '30%' }}>How it was measured</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field, index) => (
              <tr key={field.key ?? index}>
                <td>{field.label}</td>
                <td className={`doc-num ${isGap(field) ? 'doc-gap' : ''}`}>{fieldText(field)}</td>
                <td className={field.measurement ? '' : 'doc-gap'}>
                  {/* A client's guess at their own response time is usually wrong by a
                      factor of three, so which numbers you can defend is recorded. */}
                  {field.measurement ?? GAP_TEXT}
                  {field.measurement_note && (
                    <span className="block text-[8pt] text-[#918da2]">{field.measurement_note}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <LeadSources block={block} />
        <Tooling block={block} />
      </>
    );
  }

  const growth = rows as GrowthRow[];
  const improved = growth.filter((row) => row.improved === true).length;
  const worse = growth.filter((row) => row.improved === false).length;

  return (
    <>
      <table className="doc-table">
        <thead>
          <tr>
            <th>Measure</th>
            <th className="doc-num">At baseline</th>
            <th className="doc-num">Now</th>
            <th className="doc-num">Change</th>
          </tr>
        </thead>
        <tbody>
          {growth.map((row) => (
            <tr key={row.key}>
              <td>{row.label}</td>
              <td className={`doc-num ${isGap(row.baseline) ? 'doc-gap' : ''}`}>{fieldText(row.baseline)}</td>
              <td className={`doc-num ${isGap(row.current) ? 'doc-gap' : ''}`}>{fieldText(row.current)}</td>
              <td
                className={`doc-num ${
                  row.absolute_change === null
                    ? 'doc-gap'
                    : row.improved === false
                      ? 'font-semibold text-[#b4443f]'
                      : row.improved === true
                        ? 'font-semibold text-[#2f7d5c]'
                        : ''
                }`}
              >
                {formatChange(row.absolute_change, row.percent_change, row.unit)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Metrics that improved and metrics that did not are both shown. A report
          that only surfaces the good numbers fails the first time a client pushes
          back. */}
      {(improved > 0 || worse > 0) && (
        <p className="mt-[4mm] text-[8.5pt] text-[#5d5a6b]">
          {improved} measure{improved === 1 ? '' : 's'} improved against the baseline,{' '}
          {worse === 0 ? 'and none moved the wrong way' : `${worse} moved the wrong way`}.
          {block?.as_at ? ` Current figures as at ${formatShortDate(block.as_at)}.` : ''}
        </p>
      )}
    </>
  );
}

/** Any block whose rows are plain bound fields: the funnel, the leak, the terms. */
function BoundTable({ block }: { block: BoundBlock | null }) {
  const rows = (block?.rows ?? []) as unknown[];
  if (rows.length === 0) return <NoData />;

  const first = rows[0] as Record<string, unknown>;

  if (typeof first?.status === 'string' || typeof first?.label === 'string') {
    const fields = rows as BoundField[];
    return (
      <table className="doc-table">
        <thead>
          <tr>
            <th>Measure</th>
            <th className="doc-num">Value</th>
            <th style={{ width: '38%' }}>Source</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field, index) => (
            <tr key={index}>
              <td>
                {field.label}
                {field.note && <span className="block text-[8pt] text-[#918da2]">{field.note}</span>}
              </td>
              <td className={`doc-num ${isGap(field) ? 'doc-gap' : ''}`}>{fieldText(field)}</td>
              <td className="text-[8.5pt] text-[#5d5a6b]">{field.source ?? GAP_TEXT}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  // Drive folder references on the install report.
  if (typeof first?.category === 'string') {
    const folders = rows as { category: string; url: string | null }[];
    return (
      <table className="doc-table">
        <thead>
          <tr>
            <th>Where</th>
            <th>What is there</th>
          </tr>
        </thead>
        <tbody>
          {folders.map((folder) => (
            <tr key={folder.category}>
              <td className="capitalize">{folder.category.replace(/_/g, ' ')}</td>
              <td>
                {folder.url ? (
                  <a href={folder.url} className="text-[#6650d8] underline">
                    Open in Google Drive
                  </a>
                ) : (
                  <span className="doc-gap">{GAP_TEXT}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  // Install components, and the trajectory block on the quarterly review.
  if (typeof first?.title === 'string') {
    const components = rows as { title: string; description: string | null; occurred_on: string }[];
    return (
      <table className="doc-table">
        <thead>
          <tr>
            <th style={{ width: '26%' }}>Component</th>
            <th>What it does</th>
            <th className="doc-num">Live since</th>
          </tr>
        </thead>
        <tbody>
          {components.map((component, index) => (
            <tr key={index}>
              <td className="font-semibold">{component.title}</td>
              <td className={component.description ? '' : 'doc-gap'}>{component.description ?? GAP_TEXT}</td>
              <td className="doc-num">{formatShortDate(component.occurred_on)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (block?.metrics) return <Trajectory metrics={block.metrics} />;

  return <NoData />;
}

/** Direction of travel, drawn as a bar per snapshot so the arc is visible on paper. */
function Trajectory({ metrics }: { metrics: TrajectoryMetric[] }) {
  const withPoints = metrics.filter((metric) => metric.points.length > 1);
  if (withPoints.length === 0) return <NoData />;

  return (
    <div className="space-y-[7mm]">
      {withPoints.map((metric) => {
        const values = metric.points.map((point) => point.value);
        const max = Math.max(...values);
        const min = Math.min(...values, 0);
        const span = max - min || 1;

        return (
          <div key={metric.key}>
            <p className="text-[9pt] font-semibold text-[#241d49]">{metric.label}</p>
            <div className="mt-1.5 flex items-end gap-[2px]" style={{ height: '18mm' }}>
              {metric.points.map((point, index) => {
                const height = ((point.value - min) / span) * 100;
                const isBaseline = point.kind === 'baseline';
                return (
                  <div
                    key={index}
                    className="flex-1"
                    style={{
                      height: `${Math.max(height, 2)}%`,
                      background: isBaseline ? '#918da2' : '#6650d8',
                      opacity: isBaseline ? 1 : 0.45 + (index / metric.points.length) * 0.55,
                    }}
                    title={`${formatShortDate(point.period_end)}: ${formatValue(point.value, metric.unit)}`}
                  />
                );
              })}
            </div>
            <div className="mt-1 flex justify-between text-[7.5pt] text-[#918da2]">
              <span>
                Baseline {formatValue(metric.points[0].value, metric.unit)}
              </span>
              <span>
                Latest {formatValue(metric.points[metric.points.length - 1].value, metric.unit)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LeadSources({ block }: { block: BoundBlock | null }) {
  const sources = block?.lead_sources ?? [];
  if (sources.length === 0) return null;

  return (
    <div className="mt-[7mm]">
      <p className="mb-1.5 text-[8.5pt] font-semibold uppercase tracking-[0.12em] text-[#5d5a6b]">
        By source, per month
      </p>
      <table className="doc-table">
        <thead>
          <tr>
            <th>Source</th>
            <th className="doc-num">Leads per month</th>
          </tr>
        </thead>
        <tbody>
          {sources.map((source, index) => (
            <tr key={index}>
              <td>{source.label}</td>
              <td className={`doc-num ${isGap(source) ? 'doc-gap' : ''}`}>{fieldText(source)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Tooling({ block }: { block: BoundBlock | null }) {
  const tooling = block?.tooling ?? [];
  if (tooling.length === 0) return null;

  return (
    <p className="mt-[6mm] text-[9pt] text-[#5d5a6b]">
      <span className="font-semibold text-[#241d49]">Tools in place at capture: </span>
      {tooling.join(', ')}.
    </p>
  );
}

/** Milestones sit on the same timeline as the numbers, which is the argument. */
function Milestones({ block }: { block: BoundBlock | null }) {
  const rows = (block?.rows ?? []) as MilestoneRow[];
  if (rows.length === 0) return <NoData detail="No milestones fall inside this period." />;

  return (
    <ol className="space-y-[4mm]">
      {rows.map((milestone, index) => (
        <li key={index} className="flex gap-4">
          <div className="w-[26mm] shrink-0 text-[8.5pt] font-semibold text-[#6650d8]">
            {formatShortDate(milestone.occurred_on)}
          </div>
          <div className="min-w-0 border-l-2 border-[#ddd5fb] pl-4">
            <p className="text-[9.5pt] font-semibold text-[#241d49]">{milestone.title}</p>
            <p className="text-[8pt] uppercase tracking-[0.1em] text-[#918da2]">
              {milestoneLabel(milestone.type)}
            </p>
            {milestone.description && <p className="mt-1 text-[9.5pt]">{milestone.description}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Only present when DA chose to disclose the work behind the numbers. */
function Effort({ block }: { block: BoundBlock | null }) {
  if (block?.withheld) {
    return <NoData detail="The work log was not included in this report." />;
  }

  const rows = (block?.rows ?? []) as EffortRow[];
  if (rows.length === 0) return <NoData detail="No work was logged inside this period." />;

  return (
    <table className="doc-table">
      <thead>
        <tr>
          <th style={{ width: '22mm' }}>Date</th>
          <th style={{ width: '26%' }}>Phase</th>
          <th>What was done</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((entry, index) => (
          <tr key={index}>
            <td className="doc-num">{formatShortDate(entry.performed_on)}</td>
            <td className={entry.phase ? '' : 'doc-gap'}>{entry.phase ?? GAP_TEXT}</td>
            <td>{entry.description}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Evidence({ block }: { block: BoundBlock | null }) {
  const rows = (block?.rows ?? []) as EvidenceRow[];
  if (rows.length === 0) return <NoData detail="No evidence was selected for this report." />;

  return (
    <table className="doc-table">
      <thead>
        <tr>
          <th style={{ width: '24mm' }}>Happened</th>
          <th>What it proves</th>
          <th style={{ width: '30%' }}>File</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((item) => (
          <tr key={item.id}>
            <td className="doc-num">{formatShortDate(item.happened_on)}</td>
            <td className={item.what_it_proves ? '' : 'doc-gap'}>{item.what_it_proves ?? GAP_TEXT}</td>
            <td className="text-[8.5pt] text-[#5d5a6b]">{item.filename}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Requests on record, and what was quoted against them. */
function Scope({ block }: { block: BoundBlock | null }) {
  const rows = (block?.rows ?? []) as ScopeRow[];
  const terms = block?.terms ?? [];

  if (rows.length === 0 && terms.length === 0) return <NoData />;

  return (
    <>
      {rows.length > 0 && (
        <table className="doc-table">
          <thead>
            <tr>
              <th style={{ width: '24mm' }}>Requested</th>
              <th>Request</th>
              <th style={{ width: '24%' }}>Position</th>
              <th className="doc-num" style={{ width: '22mm' }}>
                Quoted
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((request, index) => {
              const quote = request.quotes[request.quotes.length - 1];
              return (
                <tr key={index}>
                  <td className="doc-num">{formatShortDate(request.requested_on)}</td>
                  <td>{request.summary}</td>
                  <td>{request.verdict === 'in_scope' ? 'Included in the engagement' : 'Outside the engagement'}</td>
                  <td className={`doc-num ${quote?.amount ? '' : 'doc-gap'}`}>
                    {quote?.amount ? formatValue(quote.amount, 'currency') : 'Not quoted'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {terms.length > 0 && (
        <div className="mt-[7mm]">
          <table className="doc-table">
            <thead>
              <tr>
                <th>Term</th>
                <th className="doc-num">Value</th>
              </tr>
            </thead>
            <tbody>
              {terms.map((term, index) => (
                <tr key={index}>
                  <td>{term.label}</td>
                  <td className={`doc-num ${isGap(term) ? 'doc-gap' : ''}`}>{fieldText(term)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function NoData({ detail }: { detail?: string }) {
  return <p className="doc-gap text-[9.5pt]">{detail ?? 'This data was not captured.'}</p>;
}
