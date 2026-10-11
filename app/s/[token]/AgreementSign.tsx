'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { Great_Vibes } from 'next/font/google';
import { DocusealForm } from '@docuseal/react';
import { consentsForRecipientType } from '@/lib/workspace/consents';

const script = Great_Vibes({ weight: '400', subsets: ['latin'], display: 'swap' });

type SignFieldNames = { signature: string[]; initials: string[] };

type Props = {
  token: string;
  embedSrc: string | null;
  recipientName: string;
  recipientType: string;
  signFields: SignFieldNames;
  onDone: () => void;
};

const DocumentPreview = memo(function DocumentPreview({ src }: { src: string }) {
  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-[var(--ws-border)] bg-white">
      <DocusealForm
        src={src}
        preview
        withTitle={false}
        withDecline={false}
        withDownloadButton={false}
        allowTypedSignature={false}
        backgroundColor="#ffffff"
        customCss="#submit_form_button { display: none; }"
      />
    </section>
  );
});

function joinNames(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

function initialsFrom(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 4);
}

function canvasFont(size: number, family: string): string {
  const safe = family.includes(' ') || family.includes(',') ? `"${family}"` : family;
  return `${size}px ${safe}, cursive`;
}

function InkPad({
  label,
  hint,
  tall,
  startMode,
  typedDefault,
  placeholder,
  maxLength,
  onChange,
}: {
  label: string;
  hint: string;
  tall: boolean;
  startMode: 'draw' | 'type';
  typedDefault: string;
  placeholder: string;
  maxLength: number;
  onChange: (dataUrl: string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const generation = useRef(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [mode, setMode] = useState<'draw' | 'type'>(startMode);
  const [typed, setTyped] = useState(typedDefault);

  useEffect(() => {
    if (mode !== 'draw') return;
    const canvas = canvasRef.current;
    const frame = canvas?.parentElement;
    if (!canvas || !frame) return;

    const fit = () => {
      const width = Math.floor(frame.clientWidth);
      if (width < 40) return;
      const height = tall ? 168 : 112;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const nextWidth = Math.floor(width * dpr);
      const nextHeight = Math.floor(height * dpr);
      if (canvas.width === nextWidth && canvas.height === nextHeight) return;
      canvas.width = nextWidth;
      canvas.height = nextHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 2.25;
      ctx.strokeStyle = '#1a1a1a';
      ctx.fillStyle = '#1a1a1a';
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [mode, tall]);

  async function publishTyped(value: string) {
    const ticket = ++generation.current;
    const text = value.trim().slice(0, maxLength);
    if (!text) {
      onChangeRef.current(null);
      return;
    }
    const canvas = document.createElement('canvas');
    const width = tall ? 900 : 420;
    const height = tall ? 260 : 180;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const size = Math.max(28, Math.min(tall ? 84 : 72, Math.floor((width - 48) / Math.max(text.length * 0.55, 1))));
    const font = canvasFont(size, script.style.fontFamily);
    try {
      await document.fonts.load(font);
    } catch {
      // The cursive fallback still produces an image.
    }
    ctx.font = font;
    ctx.fillStyle = '#1a1a1a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, width / 2, height / 2);
    if (ticket !== generation.current) return;
    onChangeRef.current(canvas.toDataURL('image/png'));
  }

  useEffect(() => {
    if (mode === 'type') void publishTyped(typed);
    // The typed default should land once, when this mode is showing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function startDraw(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    drawing.current = true;
    const here = point(event);
    last.current = here;
    ctx.beginPath();
    ctx.moveTo(here.x, here.y);
    ctx.lineTo(here.x + 0.01, here.y);
    ctx.stroke();
  }

  function moveDraw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || !last.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const here = point(event);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(here.x, here.y);
    ctx.stroke();
    last.current = here;
  }

  function endDraw() {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    const canvas = canvasRef.current;
    if (canvas) onChangeRef.current(canvas.toDataURL('image/png'));
  }

  function clear() {
    generation.current += 1;
    drawing.current = false;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
    setTyped('');
    onChangeRef.current(null);
  }

  function switchMode(next: 'draw' | 'type') {
    if (next === mode) return;
    generation.current += 1;
    drawing.current = false;
    onChangeRef.current(null);
    setMode(next);
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-neutral-900">{label}</span>
        <div className="flex rounded-full bg-neutral-100 p-0.5 text-xs font-semibold">
          {(['draw', 'type'] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={mode === option}
              onClick={() => switchMode(option)}
              className={
                mode === option
                  ? 'rounded-full bg-white px-3 py-1 text-neutral-900 shadow-sm'
                  : 'rounded-full px-3 py-1 text-neutral-500'
              }
            >
              {option === 'draw' ? 'Draw' : 'Type'}
            </button>
          ))}
        </div>
      </div>
      <div
        className="relative mt-2 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50"
        style={{ minHeight: tall ? 168 : 112 }}
      >
        {mode === 'draw' ? (
          <canvas
            ref={canvasRef}
            aria-label={label}
            className="block w-full touch-none cursor-crosshair"
            style={{ height: tall ? 168 : 112 }}
            onPointerDown={startDraw}
            onPointerMove={moveDraw}
            onPointerUp={endDraw}
            onPointerCancel={endDraw}
          />
        ) : (
          <input
            value={typed}
            placeholder={placeholder}
            maxLength={maxLength}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label={label}
            onChange={(event) => {
              const next = event.target.value.slice(0, maxLength);
              setTyped(next);
              void publishTyped(next);
            }}
            className="block h-full w-full bg-transparent px-4 text-center text-neutral-900 outline-none placeholder:text-neutral-300"
            style={{ fontFamily: script.style.fontFamily, fontSize: tall ? 44 : 36, height: tall ? 168 : 112 }}
          />
        )}
        <div className="pointer-events-none absolute inset-x-6 bottom-6 border-b border-neutral-300" />
      </div>
      <div className="mt-2 flex items-start justify-between gap-3">
        <p className="text-xs leading-relaxed text-neutral-500">{hint}</p>
        <button type="button" onClick={clear} className="shrink-0 text-xs font-semibold text-neutral-500">
          Clear
        </button>
      </div>
    </div>
  );
}

export default function AgreementSign({
  token,
  embedSrc,
  recipientName,
  recipientType,
  signFields,
  onDone,
}: Props) {
  const consents = consentsForRecipientType(recipientType);
  const [forceInitials, setForceInitials] = useState(false);
  const needsInitials = signFields.initials.length > 0 || forceInitials;
  const [signature, setSignature] = useState<string | null>(null);
  const [initials, setInitials] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [declining, setDeclining] = useState(false);

  const consentsDone = consents.every((consent) => checked[consent.id]);
  const canSubmit = Boolean(signature) && (!needsInitials || Boolean(initials)) && consentsDone && !pending;

  const signatureHint = signFields.signature.length
    ? `Placed on ${joinNames(signFields.signature)}.`
    : 'Placed on each signature line in the agreement.';
  const initialsHint = signFields.initials.length
    ? `Placed on ${joinNames(signFields.initials)}.`
    : 'Placed on each initials line in the agreement.';

  async function submit() {
    if (!canSubmit || !signature) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/s/${encodeURIComponent(token)}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signature,
          initials: needsInitials ? initials : undefined,
          consentIds: consents.filter((consent) => checked[consent.id]).map((consent) => consent.id),
        }),
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !payload?.ok) {
        if (payload?.error?.toLowerCase().includes('initials')) setForceInitials(true);
        setError(payload?.error || "We couldn't place your signature on the agreement. Please try again.");
        setPending(false);
        return;
      }
      onDone();
    } catch {
      setError("We couldn't place your signature. Check your connection and try again.");
      setPending(false);
    }
  }

  if (declining && embedSrc) {
    return (
      <section className="mt-4 overflow-hidden rounded-2xl border border-[var(--ws-border)] bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-neutral-200 px-5 py-4">
          <p className="text-sm text-neutral-700">Use Decline in the form if you do not want to sign.</p>
          <button type="button" onClick={() => setDeclining(false)} className="text-sm font-semibold text-neutral-900">
            Back to signing
          </button>
        </div>
        <DocusealForm
          src={embedSrc}
          withTitle={false}
          withDecline
          withDownloadButton={false}
          backgroundColor="#ffffff"
          onComplete={onDone}
          onDecline={onDone}
        />
      </section>
    );
  }

  return (
    <>
      {embedSrc ? <DocumentPreview src={embedSrc} /> : null}

      <section className="mt-4 rounded-2xl border border-[var(--ws-border)] bg-white p-5 sm:p-7">
        <h2 className="text-lg font-semibold text-neutral-900">Your signature</h2>
        <p className="mt-1 text-sm leading-relaxed text-neutral-600">
          Sign once here. We place that signature on each signature line in the agreement.
        </p>

        <div className="mt-5">
          <InkPad
            label="Signature"
            hint={signatureHint}
            tall
            startMode="draw"
            typedDefault=""
            placeholder={recipientName || 'Your name'}
            maxLength={80}
            onChange={setSignature}
          />
        </div>

        {needsInitials ? (
          <div className="mt-6">
            <InkPad
              label="Initials"
              hint={initialsHint}
              tall={false}
              startMode="type"
              typedDefault={initialsFrom(recipientName)}
              placeholder="AB"
              maxLength={8}
              onChange={setInitials}
            />
          </div>
        ) : null}

        <fieldset className="mt-6 space-y-3">
          <legend className="text-sm font-semibold text-neutral-900">Before you sign</legend>
          {consents.map((consent) => (
            <label key={consent.id} className="flex gap-3 text-sm leading-relaxed text-neutral-700">
              <input
                type="checkbox"
                checked={Boolean(checked[consent.id])}
                onChange={(event) => setChecked((current) => ({ ...current, [consent.id]: event.target.checked }))}
                className="mt-1 h-4 w-4 shrink-0 accent-[var(--ws-accent)]"
              />
              <span>{consent.label}</span>
            </label>
          ))}
        </fieldset>

        {error ? (
          <p role="alert" className="mt-4 text-sm text-red-600">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => void submit()}
          disabled={!canSubmit}
          aria-busy={pending}
          className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-[var(--ws-btn)] px-6 py-3 text-sm font-semibold text-[var(--ws-page)] disabled:opacity-50"
        >
          {pending ? 'Placing signature…' : 'Sign agreement'}
        </button>

        {embedSrc ? (
          <button
            type="button"
            onClick={() => setDeclining(true)}
            className="mt-4 block w-full text-center text-sm text-neutral-500 underline-offset-2 hover:underline"
          >
            Decline this agreement
          </button>
        ) : null}
      </section>
    </>
  );
}
