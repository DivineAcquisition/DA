'use client';

import { useState, useTransition } from 'react';
import { btnPrimary, btnSizeSm } from '@/app/components/ui';
import { inputClass, labelClass } from '@/app/vistrial/components/ui';
import { answerMessageAction } from '@/lib/da/billingActions';

export default function AnswerMessageForm({ messageId }: { messageId: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-3"
      action={(formData) =>
        startTransition(async () => {
          const result = await answerMessageAction(messageId, String(formData.get('answer') ?? ''));
          setMessage(result.ok ? result.message : result.error);
        })
      }
    >
      <div>
        <label className={labelClass} htmlFor={`a-${messageId}`}>
          Answer
        </label>
        <textarea
          id={`a-${messageId}`}
          name="answer"
          rows={2}
          required
          className={`${inputClass} resize-none`}
          placeholder="The client sees this on their dashboard."
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={`${btnPrimary} ${btnSizeSm}`}>
          {pending ? 'Sending…' : 'Answer'}
        </button>
        {message && <span className="text-xs text-neutral-500">{message}</span>}
      </div>
    </form>
  );
}
