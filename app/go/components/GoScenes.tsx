const KINDS = {
  'Missed-call & after-hours booking': 'missed',
  'Speed-to-lead on Facebook & Google forms': 'speed',
  '21-day quote follow-up': 'quotes',
  'Show-rate & no-show recovery': 'show',
  'Recurring conversion on the booking page': 'recur',
  'Post-clean reviews & win-backs': 'reviews',
  'Book the missed call': 'missed',
  'Close the estimate': 'quotes',
  'Keep the client': 'recur',
  'Strategy session': 'session',
  'We install it': 'install',
  'The calendar fills': 'fills',
} as const;

type Kind = (typeof KINDS)[keyof typeof KINDS];

const SHARED: Partial<Record<Kind, string>> = {
  quotes: 'lx-scene-nurture',
  install: 'lx-scene-install',
  session: 'lx-scene-intake',
};

export function GoScene({ title }: { title: string }) {
  const kind = KINDS[title as keyof typeof KINDS] as Kind | undefined;
  if (!kind) return null;
  return (
    <div className={`lx-scene go-scene go-scene-${kind} ${SHARED[kind] ?? ''}`} aria-hidden>
      {kind === 'missed' && <Missed />}
      {kind === 'speed' && <Speed />}
      {kind === 'quotes' && <Quotes />}
      {kind === 'show' && <Show />}
      {kind === 'recur' && <Recur />}
      {kind === 'reviews' && <Reviews />}
      {kind === 'session' && <Session />}
      {kind === 'install' && <Install />}
      {kind === 'fills' && <Fills />}
    </div>
  );
}

function Missed() {
  return (
    <div className="go-scene-row">
      <span>Missed call</span>
      <span>AI answers</span>
      <span>Booked</span>
    </div>
  );
}

function Speed() {
  return (
    <>
      <div className="go-scene-row">
        <span>Facebook</span>
        <span>Google</span>
      </div>
      <div className="go-scene-ping">
        Text back
        <b>
          <i>2 sec</i>
          <i>2 sec</i>
        </b>
      </div>
    </>
  );
}

function Quotes() {
  return (
    <ol>
      <li>Day 1</li>
      <li>Day 7</li>
      <li>Day 14</li>
      <li>Booked</li>
    </ol>
  );
}

function Show() {
  return (
    <div className="go-scene-row">
      <span>24h</span>
      <span>2h</span>
      <span>No-show</span>
      <span>Rebooked</span>
    </div>
  );
}

function Recur() {
  return (
    <div className="go-scene-flip">
      <span>One-time clean</span>
      <span>Bi-weekly</span>
    </div>
  );
}

function Reviews() {
  return (
    <div className="go-scene-row">
      <span>Clean done</span>
      <span>Review</span>
      <span>Win-back</span>
    </div>
  );
}

function Session() {
  return (
    <>
      <div className="lx-scene-sources">
        <span>Missed calls</span>
        <span>Calendar</span>
        <span>Stalled leads</span>
      </div>
      <div className="lx-scene-lane" />
      <div className="lx-scene-inbox">
        <strong>The leak</strong>
        <em>Named on the call</em>
      </div>
    </>
  );
}

function Install() {
  return (
    <>
      <div className="lx-scene-days">
        <i />
      </div>
      <em className="lx-scene-daylabel">Live in 14 days</em>
      <div className="lx-scene-build">
        <span>Booking</span>
        <span>Follow-up</span>
        <span>Retention</span>
      </div>
    </>
  );
}

function Fills() {
  return (
    <div className="go-scene-cal">
      <span />
      <span />
      <span />
      <span />
      <span>Recurring</span>
      <span />
      <span />
      <span />
    </div>
  );
}
