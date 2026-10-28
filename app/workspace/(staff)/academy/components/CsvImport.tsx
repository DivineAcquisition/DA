'use client';

import { useState } from 'react';
import { Button } from '../../components/ui';

type Issue = { line: number; label: string; message: string };
type Plan = { creates: { line: number }[]; skips: Issue[] };

export default function CsvImport({
  label,
  preview,
  confirm,
}: {
  label: string;
  preview: (formData: FormData) => Promise<{ ok: true; plan: Plan } | { ok: false; error: string }>;
  confirm: (formData: FormData) => Promise<{ ok: true; created: number; skipped: number } | { ok: false; error: string }>;
}) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [files, setFiles] = useState<FormData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <form
        className="space-y-4"
        action={(formData) => {
          setError(null);
          setResult(null);
          setFiles(formData);
          void preview(formData).then((response) => {
            if (!response.ok) setError(response.error);
            else setPlan(response.plan);
          });
        }}
      >
        <label className="block text-sm text-neutral-300">
          {label}
          <input name="manifest" type="file" accept=".csv,text/csv" required className="mt-1 block w-full text-sm" />
        </label>
        <Button type="submit" variant="secondary">Preview</Button>
      </form>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {plan ? (
        <div className="space-y-3 text-sm text-neutral-200">
          <p>{plan.creates.length} to create. {plan.skips.length} to skip. Existing rows stay.</p>
          <ul className="space-y-1">
            {plan.skips.map((skip) => (
              <li key={`${skip.line}-${skip.message}`} className="text-amber-200">Line {skip.line}: {skip.message}</li>
            ))}
          </ul>
          <Button
            type="button"
            onClick={() => {
              if (!files) return;
              void confirm(files).then((response) => {
                if (!response.ok) setError(response.error);
                else {
                  setResult(`Saved ${response.created}. Skipped ${response.skipped}.`);
                  setPlan({ creates: [], skips: [] });
                }
              });
            }}
          >
            Confirm import
          </Button>
          {result ? <p>{result}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
