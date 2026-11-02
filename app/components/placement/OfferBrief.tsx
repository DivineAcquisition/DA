import { OFFER_FIELDS, type OfferBrief } from '@/lib/placement/offer';

/** The same layout on the wizard preview and the operator's client card. */
export function OfferBriefView({
  client,
  offer,
  outcomes = [],
  shift,
}: {
  client?: string | null;
  offer: Partial<OfferBrief>;
  outcomes?: Array<{ name: string; definition: string }>;
  shift?: string | null;
}) {
  return (
    <div className="space-y-3 text-sm">
      {client ? <p className="text-base font-semibold text-white">{client}</p> : null}
      {shift ? <p className="text-neutral-400">{shift}</p> : null}
      {OFFER_FIELDS.map((field) => {
        const value = String(offer[field.key] ?? '').trim();
        if (!value && !field.required) return null;
        return (
          <details key={field.key} open className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
            <summary className="cursor-pointer font-medium text-white">{field.label}</summary>
            <p className="mt-2 whitespace-pre-wrap text-neutral-200">{value || 'Not written yet.'}</p>
          </details>
        );
      })}
      {outcomes.length > 0 ? (
        <details open className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
          <summary className="cursor-pointer font-medium text-white">What counts as a win</summary>
          <ul className="mt-2 space-y-2">
            {outcomes.map((outcome) => (
              <li key={outcome.name}>
                <span className="text-white">{outcome.name}</span>
                <span className="text-neutral-300"> — {outcome.definition}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
