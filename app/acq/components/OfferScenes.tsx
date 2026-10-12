const KINDS = {
  'Lead intake restructure': 'intake',
  'Buying-intent scoring': 'score',
  'Nurture and education sequences': 'nurture',
  'AI workflows for setters and closers': 'brief',
  'Call protection': 'protect',
  'Tracking, reporting, and weekly tuning': 'report',
} as const;

type Kind = (typeof KINDS)[keyof typeof KINDS];

export function OfferScene({ title }: { title: string }) {
  const kind = KINDS[title as keyof typeof KINDS] as Kind | undefined;
  if (!kind) return null;
  return (
    <div className={`lx-scene lx-scene-${kind}`} aria-hidden>
      {kind === 'intake' && <Intake />}
      {kind === 'score' && <Score />}
      {kind === 'nurture' && <Nurture />}
      {kind === 'brief' && <Brief />}
      {kind === 'protect' && <Protect />}
      {kind === 'report' && <Report />}
    </div>
  );
}

function Intake() {
  return (
    <>
      <div className="lx-scene-sources">
        <span>Form</span>
        <span>Ad</span>
        <span>DM</span>
      </div>
      <div className="lx-scene-lane" />
      <div className="lx-scene-inbox">
        <strong>One inbox</strong>
        <em>Tagged and alerted</em>
      </div>
    </>
  );
}

function Score() {
  return (
    <>
      <div className="lx-scene-lead">
        New lead
        <b>86</b>
      </div>
      <div className="lx-scene-tiers">
        <span>Ready</span>
        <span>Nurture</span>
        <span>Low</span>
      </div>
    </>
  );
}

function Nurture() {
  return (
    <ol>
      <li>First touch</li>
      <li>Day 3</li>
      <li>Day 14</li>
      <li>Re-score</li>
    </ol>
  );
}

function Brief() {
  return (
    <>
      <div className="lx-scene-call">Booked call</div>
      <ul>
        <li>Score 86, ready</li>
        <li>Said “need to think”</li>
        <li>Open with timeline</li>
      </ul>
    </>
  );
}

function Protect() {
  return (
    <div className="lx-scene-rail">
      <span>24h</span>
      <span>2h</span>
      <span>15m</span>
      <span>On the call</span>
    </div>
  );
}

function Report() {
  return (
    <div className="lx-scene-chart">
      <span style={{ ['--h' as string]: '42%' }}>
        <i />
        Speed
      </span>
      <span style={{ ['--h' as string]: '70%' }}>
        <i />
        Show
      </span>
      <span style={{ ['--h' as string]: '54%' }}>
        <i />
        Close
      </span>
      <span style={{ ['--h' as string]: '86%' }}>
        <i />
        Worked
      </span>
    </div>
  );
}
