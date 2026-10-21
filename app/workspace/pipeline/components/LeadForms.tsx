'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  addMarketAction,
  createPipelineLeadAction,
  logPipelineEventAction,
  setMarketActiveAction,
  updatePipelineLeadAction,
} from '@/lib/workspace/pipeline-actions';
import {
  PIPELINE_STAGES,
  TOUCH_CHANNELS,
  offerLineLabel,
  stageLabel,
  touchChannelLabel,
  type Assignee,
  type Market,
  type OfferLine,
} from '@/lib/workspace/pipeline';
import type { ActionResult } from '@/lib/workspace/types';
import { Button, Card, Dialog, Field, Input, Select, Textarea } from '../../components/ui';

type Feedback = { ok: boolean; text: string } | null;

function toFeedback(result: ActionResult): Feedback {
  return result.ok ? { ok: true, text: result.message } : { ok: false, text: result.error };
}

function FeedbackLine({ result }: { result: Feedback }) {
  if (!result) return null;
  return (
    <p className={`text-sm ${result.ok ? 'text-flag-good' : 'text-[var(--ws-error)]'}`} role="status">
      {result.text}
    </p>
  );
}

/**
 * Coaching or Local markets, and the market when local. Markets that are
 * hidden stay selectable for a lead already in one.
 */
function OfferFields({
  markets,
  line,
  onLine,
  market,
}: {
  markets: Market[];
  line: OfferLine;
  onLine: (line: OfferLine) => void;
  market: string | null;
}) {
  const options = markets.filter((option) => option.active || option.slug === market);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Offer">
        <input type="hidden" name="offer_line" value={line} />
        <div className="flex gap-1 rounded-xl border border-white/10 p-1">
          {(['coaching', 'local'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onLine(option)}
              className={`flex-1 rounded-lg px-3 py-1.5 text-sm ${
                line === option ? 'bg-brand-500/20 text-white' : 'text-neutral-400 hover:text-white'
              }`}
            >
              {offerLineLabel(option)}
            </button>
          ))}
        </div>
      </Field>
      {line === 'local' ? (
        <Field label="Market">
          <Select name="market" defaultValue={market ?? options[0]?.slug ?? ''} required>
            {options.length === 0 && <option value="">Add a market first</option>}
            {options.map((option) => (
              <option key={option.slug} value={option.slug}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
      ) : (
        <div aria-hidden />
      )}
    </div>
  );
}

export function LeadUpdateForm({
  id,
  stage,
  ownerId,
  nextAction,
  offerLine,
  market,
  assignees,
  markets,
}: {
  id: string;
  stage: string;
  ownerId: string | null;
  nextAction: string;
  offerLine: OfferLine;
  market: string | null;
  assignees: Assignee[];
  markets: Market[];
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<Feedback>(null);
  const [line, setLine] = useState<OfferLine>(offerLine);
  const ownerMissing = ownerId !== null && !assignees.some((person) => person.id === ownerId);

  return (
    <Card className="p-5">
      <h2 className="mb-4 text-sm font-semibold text-white">Work this lead</h2>
      <form
        className="space-y-4"
        action={(formData) => {
          setResult(null);
          startTransition(async () => setResult(toFeedback(await updatePipelineLeadAction(formData))));
        }}
      >
        <input type="hidden" name="id" value={id} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Stage">
            <Select name="stage" defaultValue={stage}>
              {PIPELINE_STAGES.map((option) => (
                <option key={option} value={option}>
                  {stageLabel(option, line)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Owner">
            <Select name="owner_id" defaultValue={ownerId ?? ''}>
              <option value="">Unassigned</option>
              {ownerMissing && <option value={ownerId ?? ''}>Former staff</option>}
              {assignees.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <OfferFields markets={markets} line={line} onLine={setLine} market={market} />
        <Field label="Next step" hint="What happens next and when, in a line.">
          <Input name="next_action" defaultValue={nextAction} maxLength={500} />
        </Field>
        <div className="flex items-center justify-between gap-3">
          <FeedbackLine result={result} />
          <Button type="submit" disabled={pending} className="ml-auto">
            {pending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function LeadActivityForm({ id }: { id: string }) {
  const [kind, setKind] = useState<'touch' | 'note'>('touch');
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<Feedback>(null);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-white">Log activity</h2>
        <div className="flex gap-1 rounded-lg border border-white/10 p-0.5 text-xs">
          {(['touch', 'note'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setKind(option)}
              className={`rounded-md px-2.5 py-1 ${kind === option ? 'bg-white/10 text-white' : 'text-neutral-400 hover:text-white'}`}
            >
              {option === 'touch' ? 'Touch' : 'Note'}
            </button>
          ))}
        </div>
      </div>
      <form
        ref={formRef}
        className="space-y-4"
        action={(formData) => {
          setResult(null);
          startTransition(async () => {
            const outcome = await logPipelineEventAction(formData);
            if (outcome.ok) formRef.current?.reset();
            setResult(toFeedback(outcome));
          });
        }}
      >
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="kind" value={kind} />
        {kind === 'touch' && (
          <Field label="How you reached them">
            <Select name="channel" defaultValue="call">
              {TOUCH_CHANNELS.map((channel) => (
                <option key={channel} value={channel}>
                  {touchChannelLabel(channel)}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label={kind === 'touch' ? 'What happened (optional)' : 'Note'}>
          <Textarea name="body" rows={3} maxLength={4000} required={kind === 'note'} />
        </Field>
        <div className="flex items-center justify-between gap-3">
          <FeedbackLine result={result} />
          <Button type="submit" disabled={pending} className="ml-auto">
            {pending ? 'Saving…' : kind === 'touch' ? 'Log touch' : 'Add note'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function NewLeadButton({
  assignees,
  markets,
  defaultLine,
  defaultMarket,
}: {
  assignees: Assignee[];
  markets: Market[];
  defaultLine: OfferLine;
  defaultMarket: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [line, setLine] = useState<OfferLine>(defaultLine);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<Feedback>(null);

  return (
    <>
      <Button
        type="button"
        onClick={() => {
          setLine(defaultLine);
          setResult(null);
          setOpen(true);
        }}
      >
        New lead
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="New lead">
        <form
          className="space-y-4"
          action={(formData) => {
            setResult(null);
            startTransition(async () => {
              const outcome = await createPipelineLeadAction(formData);
              if (outcome.ok && typeof outcome.data?.id === 'string') {
                setOpen(false);
                router.push(`/workspace/pipeline/${outcome.data.id}`);
                return;
              }
              setResult(toFeedback(outcome));
            });
          }}
        >
          <OfferFields markets={markets} line={line} onLine={setLine} market={defaultMarket} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Contact name">
              <Input name="full_name" required minLength={2} maxLength={200} />
            </Field>
            <Field label="Business name">
              <Input name="company_name" maxLength={200} />
            </Field>
            <Field label="Email">
              <Input name="email" type="email" maxLength={320} />
            </Field>
            <Field label="Phone">
              <Input name="phone" type="tel" maxLength={40} />
            </Field>
            {line === 'local' && (
              <Field label="Specialty" hint="Trade or service, e.g. cleaning, roofing, injectables.">
                <Input name="trade" maxLength={80} />
              </Field>
            )}
            <Field label="Source" hint="Referral, outbound list, event…">
              <Input name="source" maxLength={120} />
            </Field>
          </div>
          <Field label="Owner">
            <Select name="owner_id" defaultValue="">
              <option value="">Unassigned</option>
              {assignees.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </Select>
          </Field>
          <FeedbackLine result={result} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Adding…' : 'Add lead'}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

export function MarketsButton({ markets }: { markets: Market[] }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<Feedback>(null);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        Markets
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Local markets">
        <p className="mb-4 text-sm text-[var(--ws-dim)]">
          The markets local leads are filed under. Hiding one keeps its leads but removes it from new leads.
        </p>
        <ul className="mb-5 divide-y divide-white/[0.06] rounded-xl border border-white/[0.08]">
          {markets.map((market) => (
            <li key={market.slug} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
              <span className={market.active ? 'text-white' : 'text-neutral-500'}>{market.label}</span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  const formData = new FormData();
                  formData.set('slug', market.slug);
                  formData.set('active', market.active ? 'false' : 'true');
                  setResult(null);
                  startTransition(async () => setResult(toFeedback(await setMarketActiveAction(formData))));
                }}
              >
                {market.active ? 'Hide' : 'Show'}
              </Button>
            </li>
          ))}
        </ul>
        <form
          ref={formRef}
          className="flex items-end gap-2"
          action={(formData) => {
            setResult(null);
            startTransition(async () => {
              const outcome = await addMarketAction(formData);
              if (outcome.ok) formRef.current?.reset();
              setResult(toFeedback(outcome));
            });
          }}
        >
          <div className="flex-1">
            <Field label="Add a market">
              <Input name="label" placeholder="e.g. Chiropractic" required minLength={2} maxLength={60} />
            </Field>
          </div>
          <Button type="submit" disabled={pending}>
            Add
          </Button>
        </form>
        <div className="mt-3">
          <FeedbackLine result={result} />
        </div>
      </Dialog>
    </>
  );
}
