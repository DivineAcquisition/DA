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
    <section className="mt-10 overflow-hidden rounded-[28px] border border-white/10 bg-[#f4f0e8] shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
      <div className="flex items-center justify-between border-b border-black/[0.06] px-6 py-3.5 sm:px-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8c8378]">The agreement</p>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8c8378]">Read only</p>
      </div>
      <DocusealForm
        src={src}
        preview
        withTitle={false}
        withDecline={false}
        withDownloadButton={false}
        allowTypedSignature={false}
        backgroundColor="#f4f0e8"
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
  const [blank, setBlank] = useState(startMode === 'draw');
  const height = tall ? 188 : 124;

  useEffect(() => {
    if (mode !== 'draw') return;
    const canvas = canvasRef.current;
    const frame = canvas?.parentElement;
    if (!canvas || !frame) return;

    const fit = () => {
      const width = Math.floor(frame.clientWidth);
      if (width < 40) return;
      const height = tall ? 188 : 124;
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
      setBlank(true);
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
    setBlank(false);
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
    setBlank(false);
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
    setBlank(true);
    onChangeRef.current(null);
  }

  function switchMode(next: 'draw' | 'type') {
    if (next === mode) return;
    generation.current += 1;
    drawing.current = false;
    onChangeRef.current(null);
    setBlank(next === 'draw' || !typed.trim());
    setMode(next);
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8c8378]">{label}</span>
        <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.18em]">
          {(['draw', 'type'] as const).map((option, index) => (
            <span key={option} className="flex items-center gap-3">
              {index > 0 ? <span className="text-[#d5cfc4]">/</span> : null}
              <button
                type="button"
                aria-pressed={mode === option}
                onClick={() => switchMode(option)}
                className={
                  mode === option
                    ? 'border-b border-[#1c1915] pb-0.5 text-[#1c1915]'
                    : 'pb-0.5 text-[#b3aa9e]'
                }
              >
                {option === 'draw' ? 'Draw' : 'Type'}
              </button>
            </span>
          ))}
        </div>
      </div>
      <div className="relative mt-3 overflow-hidden" style={{ minHeight: height }}>
        {mode === 'draw' ? (
          <canvas
            ref={canvasRef}
            aria-label={label}
            className="block w-full touch-none cursor-crosshair"
            style={{ height }}
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
            className="block w-full bg-transparent px-2 text-center text-[#1c1915] outline-none placeholder:text-[#d5cfc4]"
            style={{ fontFamily: script.style.fontFamily, fontSize: tall ? 52 : 40, height }}
          />
        )}
        {mode === 'draw' && blank ? (
          <p className="pointer-events-none absolute inset-x-0 top-8 text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-[#c4bdb2]">
            {tall ? 'Draw your signature' : 'Draw your initials'}
          </p>
        ) : null}
        <div className="pointer-events-none absolute inset-x-2 bottom-7 border-b border-[#1c1915]/15" />
      </div>
      <div className="mt-1 flex items-start justify-between gap-4">
        <p className="text-[12px] leading-relaxed text-[#8c8378]">{hint}</p>
        <button
          type="button"
          onClick={clear}
          className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8c8378]"
        >
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
      <section className="mt-10 overflow-hidden rounded-[28px] border border-white/10 bg-[#f4f0e8] text-[#1c1915] shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
        <div className="flex items-center justify-between gap-4 border-b border-black/[0.06] px-6 py-4 sm:px-8">
          <p className="text-sm text-[#5c564e]">Decline in the form if you do not want to sign.</p>
          <button
            type="button"
            onClick={() => setDeclining(false)}
            className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#1c1915]"
          >
            Back to signing
          </button>
        </div>
        <DocusealForm
          src={embedSrc}
          withTitle={false}
          withDecline
          withDownloadButton={false}
          backgroundColor="#f4f0e8"
          onComplete={onDone}
          onDecline={onDone}
        />
      </section>
    );
  }

  return (
    <>
      {embedSrc ? <DocumentPreview src={embedSrc} /> : null}

      <section className="mt-10 overflow-hidden rounded-[28px] bg-[#f4f0e8] text-[#1c1915] shadow-[0_40px_90px_rgba(0,0,0,0.4)]">
        <div className="border-b border-black/[0.06] px-6 py-6 sm:px-10 sm:py-7">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8c8378]">Execute</p>
          <h2 className="mt-2 text-[1.7rem] font-medium tracking-[-0.03em]">Your signature</h2>
          <p className="mt-2 max-w-[42ch] text-sm leading-relaxed text-[#5c564e]">
            Sign once. That signature is placed on each signature line in the agreement.
          </p>
        </div>

        <div className="px-6 py-7 sm:px-10 sm:py-8">
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

          {needsInitials ? (
            <div className="mt-8 border-t border-black/[0.06] pt-8 sm:max-w-sm">
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

          <fieldset className="mt-8 space-y-2.5">
            <legend className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8c8378]">
              Before you sign
            </legend>
            {consents.map((consent) => (
              <label
                key={consent.id}
                className="group flex cursor-pointer gap-3.5 rounded-2xl border border-black/[0.06] bg-white/55 px-4 py-3.5 transition hover:border-black/15"
              >
                <input
                  type="checkbox"
                  checked={Boolean(checked[consent.id])}
                  onChange={(event) => setChecked((current) => ({ ...current, [consent.id]: event.target.checked }))}
                  className="peer sr-only"
                />
                <span
                  aria-hidden
                  className="mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] border border-black/20 bg-white transition peer-checked:border-[#1c1915] peer-checked:bg-[#1c1915] peer-focus-visible:ring-2 peer-focus-visible:ring-[#9a88fc]"
                >
                  <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 opacity-0 group-has-[:checked]:opacity-100">
                    <path
                      d="M2.2 6.2 4.7 8.7 9.8 3.4"
                      fill="none"
                      stroke="white"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span className="text-sm leading-relaxed text-[#3c3832]">{consent.label}</span>
              </label>
            ))}
          </fieldset>

          {error ? (
            <p role="alert" className="mt-5 rounded-2xl bg-[#f6e4df] px-4 py-3 text-sm leading-relaxed text-[#8c332c]">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => void submit()}
            disabled={!canSubmit}
            aria-busy={pending}
            className="mt-8 inline-flex h-14 w-full items-center justify-center rounded-full bg-[#14121a] text-[12px] font-semibold tracking-[0.16em] text-[#f4f0e8] uppercase transition disabled:bg-[#ddd6cc] disabled:text-[#9a9288]"
          >
            {pending ? 'Placing signature' : 'Sign agreement'}
          </button>

          {embedSrc ? (
            <button
              type="button"
              onClick={() => setDeclining(true)}
              className="mt-5 block w-full text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8c8378]"
            >
              Decline this agreement
            </button>
          ) : null}
        </div>
      </section>
    </>
  );
}
