'use client';

import { useState } from 'react';
import { confirmQuestionImport, previewQuestionImport } from '@/lib/academy/quizAdmin';
import type { QuestionPlan } from '@/lib/academy/questionImport';
import { Button } from '../../../components/ui';

export default function QuestionImportForm() {
  const [plan, setPlan] = useState<QuestionPlan | null>(null);
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
          void previewQuestionImport(formData).then((response) => {
            if (!response.ok) setError(response.error);
            else setPlan(response.plan);
          });
        }}
      >
        <label className="block text-sm text-neutral-300">
          Question file
          <input name="manifest" type="file" accept=".csv,text/csv" required className="mt-1 block w-full text-sm" />
        </label>
        <Button type="submit" variant="secondary">Preview</Button>
      </form>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {plan ? (
        <div className="space-y-3 text-sm text-neutral-200">
          <p>{plan.creates.length} to create. {plan.skips.length} to skip.</p>
          <ul className="space-y-1">
            {plan.creates.map((row) => <li key={`c-${row.line}`}>Create {row.prompt}</li>)}
            {plan.skips.map((skip) => (
              <li key={`s-${skip.line}-${skip.prompt}`} className="text-amber-200">Line {skip.line}: {skip.message}</li>
            ))}
          </ul>
          <Button
            type="button"
            onClick={() => {
              if (!files) return;
              void confirmQuestionImport(files).then((response) => {
                if (!response.ok) setError(response.error);
                else {
                  setResult(`Saved ${response.result.created}. Skipped ${response.result.skipped}.`);
                  setPlan({
                    creates: [],
                    skips: response.result.detail.filter((row) => row.action === 'skip').map((row, index) => ({
                      line: index + 1,
                      prompt: row.prompt ?? '',
                      message: row.message ?? 'Skipped.',
                    })),
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
