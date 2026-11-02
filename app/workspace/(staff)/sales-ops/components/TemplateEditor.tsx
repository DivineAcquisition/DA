'use client';

import { useState, useTransition } from 'react';
import { Button, Field, Input, Textarea } from '../../components/ui';
import { saveTemplateAction } from '@/lib/placement/actions';

type Template = {
  slug: string;
  name: string;
  vertical: string;
  speed_tracked: boolean;
  categories: string[];
  outcomes: Array<{ name: string; definition: string }>;
  offer_outline: Record<string, string>;
  ghl: { calendars?: string[]; stage?: string | null; tag?: string | null };
  first_day: string[];
  report: Record<string, unknown>;
  active: boolean;
};

export default function TemplateEditor({ templates }: { templates: Template[] }) {
  return (
    <div className="space-y-4">
      {templates.map((template) => (
        <TemplateForm key={template.slug} template={template} />
      ))}
    </div>
  );
}

function TemplateForm({ template }: { template: Template }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-3 rounded-xl border border-white/10 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const outcomes = String(data.get('outcomes') ?? '')
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => {
            const [name, ...rest] = line.split(':');
            return { name: name.trim(), definition: rest.join(':').trim() || name.trim() };
          });
        startTransition(async () => {
          const result = await saveTemplateAction({
            slug: template.slug,
            name: data.get('name'),
            vertical: data.get('vertical'),
            speed_tracked: data.get('speed_tracked') === 'on',
            categories: data.getAll('category'),
            outcomes,
            offer_outline: template.offer_outline,
            ghl: {
              calendars: String(data.get('calendars') ?? '').split(',').map((item) => item.trim()).filter(Boolean),
              stage: String(data.get('stage') ?? '') || null,
              tag: String(data.get('tag') ?? '') || null,
            },
            first_day: String(data.get('first_day') ?? '').split('\n').map((line) => line.trim()).filter(Boolean),
            report: template.report,
            active: data.get('active') === 'on',
          });
          setMessage(result.ok ? result.message : null);
          setError(result.ok ? null : result.error);
        });
      }}
    >
      <h2 className="text-base font-semibold text-white">{template.name}</h2>
      {message ? <p className="text-sm text-emerald-200">{message}</p> : null}
      {error ? <p className="text-sm text-amber-200">{error}</p> : null}
      <Field label="Name">
        <Input name="name" defaultValue={template.name} required />
      </Field>
      <Field label="Vertical">
        <Input name="vertical" defaultValue={template.vertical} required />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="speed_tracked" defaultChecked={template.speed_tracked} /> Track speed-to-lead
      </label>
      <fieldset className="space-y-1 text-sm">
        <legend>Categories</legend>
        {[
          ['outbound_calling', 'Outbound calling'],
          ['follow_up', 'Text and email follow-up'],
          ['reactivation', 'Database reactivation'],
        ].map(([value, label]) => (
          <label key={value} className="flex items-center gap-2">
            <input type="checkbox" name="category" value={value} defaultChecked={template.categories.includes(value)} />
            {label}
          </label>
        ))}
      </fieldset>
      <Field label="Outcomes" hint="One per line: Name: definition">
        <Textarea name="outcomes" rows={4} defaultValue={template.outcomes.map((outcome) => `${outcome.name}: ${outcome.definition}`).join('\n')} />
      </Field>
      <Field label="Suggested calendars">
        <Input name="calendars" defaultValue={(template.ghl?.calendars ?? []).join(', ')} />
      </Field>
      <Field label="Suggested stage">
        <Input name="stage" defaultValue={template.ghl?.stage ?? ''} />
      </Field>
      <Field label="Suggested tag">
        <Input name="tag" defaultValue={template.ghl?.tag ?? ''} />
      </Field>
      <Field label="First-day tasks">
        <Textarea name="first_day" rows={5} defaultValue={(template.first_day ?? []).join('\n')} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={template.active} /> Active
      </label>
      <Button type="submit" disabled={pending}>
        Save template
      </Button>
    </form>
  );
}
