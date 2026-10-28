'use client';

import { useState, useTransition } from 'react';
import { createHsCallAction } from '@/lib/workspace/hs-call-actions';
import {
  HS_CALL_ROLES,
  HS_CREW_COUNTS,
  HS_PHONE_COVERAGE,
  HS_TRADES,
  hsCallRoleLabel,
  hsCrewCountLabel,
  hsPhoneCoverageLabel,
  hsTradeLabel,
} from '@/lib/workspace/hs-calls';
import { Button, Field, Input, Select, Textarea, ws } from '../../../components/ui';

export default function HsNewCallForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className={`${ws.card} space-y-4 p-5 sm:p-6`}
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await createHsCallAction(formData);
          if (result && !result.ok) setError(result.error);
        });
      }}
    >
      <Field label="Contact name">
        <Input name="contact_name" required autoComplete="name" />
      </Field>
      <Field label="Company name">
        <Input name="company_name" required autoComplete="organization" />
      </Field>
      <Field label="Trade">
        <Select name="trade" required defaultValue="">
          <option value="" disabled>
            Select trade
          </option>
          {HS_TRADES.map((trade) => (
            <option key={trade} value={trade}>
              {hsTradeLabel(trade)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Role">
        <Select name="role" required defaultValue="">
          <option value="" disabled>
            Select role
          </option>
          {HS_CALL_ROLES.map((role) => (
            <option key={role} value={role}>
              {hsCallRoleLabel(role)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Crew count">
        <Select name="crew_count" required defaultValue="">
          <option value="" disabled>
            Select crew count
          </option>
          {HS_CREW_COUNTS.map((count) => (
            <option key={count} value={count}>
              {hsCrewCountLabel(count)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Who answers the phone">
        <Select name="who_answers_phone" required defaultValue="">
          <option value="" disabled>
            Select coverage
          </option>
          {HS_PHONE_COVERAGE.map((coverage) => (
            <option key={coverage} value={coverage}>
              {hsPhoneCoverageLabel(coverage)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Phone">
        <Input name="phone" type="tel" autoComplete="tel" />
      </Field>
      <Field label="Email">
        <Input name="email" type="email" autoComplete="email" />
      </Field>
      <Field label="Stated pain">
        <Textarea name="stated_pain" placeholder="From the lead form" />
      </Field>
      <Field label="Source">
        <Input name="source" />
      </Field>
      {error && <p className="text-sm text-[#FF6A6A]">{error}</p>}
      <Button type="submit" disabled={pending} className="w-full" style={{ backgroundColor: '#6A00FF', color: '#fff' }}>
        {pending ? 'Creating…' : 'Create call'}
      </Button>
    </form>
  );
}
