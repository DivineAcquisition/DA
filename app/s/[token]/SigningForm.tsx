'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Logo from '@/app/components/Logo';
import { completeSigningAction } from '@/lib/workspace/signing-actions';
import type { ConsentItem } from '@/lib/workspace/consents';
import type { SigningField } from '@/lib/workspace/signing';

type Props = {
  token: string;
  templateName: string;
  recipientName: string;
  fields: SigningField[];
  consents: ConsentItem[];
  documents: Array<{ name: string; url: string }>;
  completed: boolean;
  signedDocumentUrl: string | null;
};

export default function SigningForm({
  token,
  templateName,
  recipientName,
  fields,
  consents,
  documents,
  completed: initiallyCompleted,
  signedDocumentUrl: initialSignedUrl,
}: Props) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.filter((f) => f.kind !== 'signature').map((f) => [f.name, f.value])),
  );
  const [consentState, setConsentState] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(consents.map((c) => [c.id, false])),
  );
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(initiallyCompleted);
  const [signedUrl, setSignedUrl] = useState(initialSignedUrl);
  const [pending, startTransition] = useTransition();
  const [activeDoc, setActiveDoc] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const hasStroke = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#111827';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }, []);

  function pointerPos(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    hasStroke.current = false;
  }

  const editableFields = fields.filter((f) => f.kind !== 'signature' && f.kind !== 'readonly');
  const allConsentsChecked = consents.every((c) => consentState[c.id]);
  const currentDoc = documents[activeDoc] ?? null;

  if (completed) {
    return (
      <div className="mx-auto max-w-2xl animate-rise rounded-2xl border border-white/10 bg-ink-850/60 p-8 text-center">
        <Logo className="mx-auto h-8 w-auto" />
        <h1 className="mt-6 text-2xl font-semibold text-white">Agreement signed</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Thank you, {recipientName}. Your signed copy of {templateName} is ready.
        </p>
        {signedUrl && (
          <a
            href={signedUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-flex items-center justify-center rounded-full bg-brand-500 px-6 py-2.5 text-sm font-semibold text-ink-950"
          >
            View signed PDF
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="animate-rise rounded-2xl border border-white/10 bg-ink-850/50 p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-300">
            Agreement PDF
          </h2>
          {documents.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {documents.map((doc, index) => (
                <button
                  key={doc.url}
                  type="button"
                  onClick={() => setActiveDoc(index)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    index === activeDoc
                      ? 'bg-brand-500 text-ink-950'
                      : 'border border-white/10 text-neutral-300'
                  }`}
                >
                  {doc.name}
                </button>
              ))}
            </div>
          )}
        </div>
        {currentDoc ? (
          <div className="overflow-hidden rounded-xl border border-white/10 bg-white">
            <iframe
              title={currentDoc.name}
              src={currentDoc.url}
              className="h-[70vh] w-full"
            />
            <div className="border-t border-black/10 bg-neutral-50 px-3 py-2 text-center">
              <a
                href={currentDoc.url}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-brand-700 hover:underline"
              >
                Open PDF in a new tab
              </a>
            </div>
          </div>
        ) : (
          <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-white/15 text-sm text-neutral-500">
            PDF preview will appear once DocuSeal documents are available for this agreement.
          </div>
        )}
      </section>

      <section className="animate-rise delay-1 space-y-5 rounded-2xl border border-white/10 bg-ink-850/50 p-5 sm:p-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-300">
            Divine Acquisition
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-white">{templateName}</h1>
          <p className="mt-1 text-sm text-neutral-400">Signing as {recipientName}</p>
        </div>

        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            if (!allConsentsChecked) {
              setError('Please accept every consent item before signing.');
              return;
            }
            if (!hasStroke.current || !canvasRef.current) {
              setError('Please draw your signature before submitting.');
              return;
            }
            const signatureDataUrl = canvasRef.current.toDataURL('image/png');
            startTransition(async () => {
              const result = await completeSigningAction({
                token,
                values,
                signatureDataUrl,
                consents: consentState,
              });
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setCompleted(true);
              setSignedUrl(result.signedDocumentUrl);
            });
          }}
        >
          <div className="space-y-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
              Your details
            </h3>
            {editableFields.map((field) => {
              if (field.kind === 'checkbox') {
                return (
                  <label key={field.name} className="flex items-start gap-3 text-sm text-neutral-200">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-white/20 bg-ink-950"
                      checked={values[field.name] === 'true'}
                      onChange={(e) =>
                        setValues((prev) => ({
                          ...prev,
                          [field.name]: e.target.checked ? 'true' : '',
                        }))
                      }
                    />
                    <span>
                      {field.name}
                      {field.required ? ' *' : ''}
                    </span>
                  </label>
                );
              }
              return (
                <label key={field.name} className="block">
                  <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
                    {field.name}
                    {field.required ? ' *' : ''}
                  </span>
                  <input
                    type={field.kind === 'date' ? 'date' : field.kind === 'number' ? 'text' : 'text'}
                    inputMode={field.kind === 'phone' || field.kind === 'number' ? 'numeric' : undefined}
                    required={field.required}
                    value={values[field.name] ?? ''}
                    onChange={(e) =>
                      setValues((prev) => ({
                        ...prev,
                        [field.name]: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white outline-none focus:border-brand-500/60"
                  />
                </label>
              );
            })}
          </div>

          <div className="space-y-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
              Consents
            </h3>
            {consents.map((consent) => (
              <label
                key={consent.id}
                className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-sm leading-relaxed text-neutral-200"
              >
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-white/20 bg-ink-950"
                  checked={Boolean(consentState[consent.id])}
                  onChange={(e) =>
                    setConsentState((prev) => ({
                      ...prev,
                      [consent.id]: e.target.checked,
                    }))
                  }
                />
                <span>{consent.label}</span>
              </label>
            ))}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                Signature *
              </h3>
              <button
                type="button"
                onClick={clearSignature}
                className="text-xs text-neutral-400 hover:text-white"
              >
                Clear
              </button>
            </div>
            <canvas
              ref={canvasRef}
              className="h-36 w-full touch-none rounded-xl border border-white/15 bg-white"
              onPointerDown={(e) => {
                const canvas = canvasRef.current;
                const ctx = canvas?.getContext('2d');
                if (!canvas || !ctx) return;
                drawing.current = true;
                canvas.setPointerCapture(e.pointerId);
                const { x, y } = pointerPos(e);
                ctx.beginPath();
                ctx.moveTo(x, y);
              }}
              onPointerMove={(e) => {
                if (!drawing.current) return;
                const ctx = canvasRef.current?.getContext('2d');
                if (!ctx) return;
                const { x, y } = pointerPos(e);
                ctx.lineTo(x, y);
                ctx.stroke();
                hasStroke.current = true;
              }}
              onPointerUp={() => {
                drawing.current = false;
              }}
              onPointerLeave={() => {
                drawing.current = false;
              }}
            />
            <p className="mt-1.5 text-xs text-neutral-500">Draw your signature with mouse or finger.</p>
          </div>

          {error && (
            <p className="rounded-xl border border-flag-critical/30 bg-flag-critical/10 px-3 py-2 text-sm text-flag-critical">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending || !allConsentsChecked}
            className="inline-flex w-full items-center justify-center rounded-full bg-brand-500 px-5 py-3 text-sm font-semibold text-ink-950 transition hover:bg-brand-400 disabled:opacity-50"
          >
            {pending ? 'Submitting…' : 'Sign agreement'}
          </button>
        </form>
      </section>
    </div>
  );
}
