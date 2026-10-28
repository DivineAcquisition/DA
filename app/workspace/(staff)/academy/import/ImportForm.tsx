'use client';

import { useState } from 'react';
import { confirmImport, previewImport } from '@/lib/academy/adminActions';
import type { ManifestPlan } from '@/lib/academy/manifest';
import { Button } from '../../components/ui';

export default function ImportForm() {
  const [plan, setPlan] = useState<ManifestPlan | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<FormData | null>(null);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-semibold text-white">Import lessons</h1>
      <p className="text-sm text-neutral-400">The preview saves nothing. Confirm writes only the valid rows.</p>
      <form
        className="space-y-4"
        action={(formData) => {
          setError(null);
          setResult(null);
          setFiles(formData);
          void previewImport(formData).then((response) => {
            if (!response.ok) setError(response.error);
            else setPlan(response.plan);
          });
        }}
      >
        <label className="block text-sm text-neutral-300">
          Manifest
          <input name="manifest" type="file" accept=".csv,text/csv" required className="mt-1 block w-full text-sm" />
        </label>
        <label className="block text-sm text-neutral-300">
          Documents and written files
          <input name="files" type="file" multiple className="mt-1 block w-full text-sm" />
        </label>
        <Button type="submit" variant="secondary">
          Preview
        </Button>
      </form>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {plan ? (
        <div className="space-y-3 text-sm text-neutral-200">
          <p>{plan.creates.length} to create. {plan.updates.length} to update. {plan.skips.length} to skip.</p>
          <ul className="space-y-1">
            {plan.creates.map((row) => (
              <li key={`c-${row.lessonId}`}>Create {row.lessonId}</li>
            ))}
            {plan.updates.map((row) => (
              <li key={`u-${row.lessonId}`}>Update {row.lessonId}</li>
            ))}
            {plan.skips.map((skip) => (
              <li key={`s-${skip.line}-${skip.lessonId}`} className="text-amber-200">
                Line {skip.line}: {skip.message}
              </li>
            ))}
          </ul>
          <Button
            type="button"
            onClick={() => {
              if (!files) return;
              setError(null);
              void confirmImport(files).then((response) => {
                if (!response.ok) setError(response.error);
                else {
                  const skipped = response.result.detail.filter((row) => row.action === 'skip');
                  setResult(`Saved ${response.result.created} new and ${response.result.updated} updated. Skipped ${response.result.skipped}.`);
                  setPlan({
                    creates: [],
                    updates: [],
                    skips: skipped.map((row, index) => ({ line: index + 1, lessonId: row.lesson_id, message: row.message ?? 'Skipped.' })),
                  });
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
