'use client';

import { useState, useTransition } from 'react';
import { createWorkspaceCallAction } from '@/lib/workspace/workspace-actions';
import {
  CALL_ROLES,
  FRONT_DESK_SIZES,
  callRoleLabel,
  frontDeskLabel,
} from '@/lib/workspace/calls';
import {
  HS_CALL_ROLES,
  HS_CREW_COUNTS,
  HS_PHONE_COVERAGE,
  hsCallRoleLabel,
  hsCrewCountLabel,
  hsPhoneCoverageLabel,
} from '@/lib/workspace/hs-calls';
import { nicheFamily, type WorkspaceNiche } from '@/lib/workspace/niches';
import NicheSelect from '../../components/NicheSelect';
import { Button, Field, Input, Select, Textarea, ws } from '../../components/ui';

export default function NewCallForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [niche, setNiche] = useState<WorkspaceNiche | ''>('');
  const family = niche ? nicheFamily(niche) : null;

  return (
    <form
      className={`${ws.card} space-y-4 p-5 sm:p-6`}
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await createWorkspaceCallAction(formData);
          if (result && !result.ok) setError(result.error);
        });
      }}
    >
      <NicheSelect value={niche} onChange={setNiche} />
      {family ? (
        <>
          <Field label="Contact name">
            <Input name="contact_name" required autoComplete="name" />
          </Field>
          <Field label={family === 'practice' ? 'Practice name' : 'Company name'}>
            <Input name="account_name" required autoComplete="organization" />
          </Field>
          {family === 'practice' ? (
            <>
              <Field label="Role">
                <Select name="role" required defaultValue="">
                  <option value="" disabled>
                    Select role
                  </option>
                  {CALL_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {callRoleLabel(role)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Front desk size">
                <Select name="front_desk_size" required defaultValue="">
                  <option value="" disabled>
                    Select size
                  </option>
                  {FRONT_DESK_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {frontDeskLabel(size)}
                    </option>
                  ))}
                </Select>
              </Field>
            </>
          ) : (
            <>
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
            </>
          )}
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
        </>
      ) : (
        <p className="text-sm text-neutral-500">
          Pick a niche first. Practice calls use the dental / med spa script. Home-services calls
          use the trade script and crew questions.
        </p>
      )}
      {error && <p className="text-sm text-[var(--ws-error)]">{error}</p>}
      <Button type="submit" disabled={pending || !family} className="w-full">
        {pending ? 'Creating…' : 'Create call'}
      </Button>
    </form>
  );
}
