'use client';

import { inputClass, labelClass, selectClass } from '@/app/vistrial/components/ui';
import { setOperatingConfigAction } from '@/lib/da/actions';
import type { IndustryTemplate } from '@/lib/da/queries';
import { ActionForm, Disclosure } from './ActionForm';

/**
 * The two things about a client that used to be decided in code: which industry
 * template shapes the EOD report, and what counts as a qualified booking.
 *
 * The template was inferred by string-matching the notes column, so an admin
 * tidying a note could change what every operator was asked. The definition was a
 * string literal shared by every client regardless of what they sold. Both are the
 * admin's to set, and changing either is audited.
 */
export default function OperatingConfigForm({
  caseFileId,
  slug,
  templates,
  currentIndustryKey,
  currentDefinition,
  currentContactRole,
  currentContactChannel,
}: {
  caseFileId: string;
  slug: string;
  templates: IndustryTemplate[];
  currentIndustryKey: string;
  currentDefinition: string | null;
  currentContactRole: string | null;
  currentContactChannel: string | null;
}) {
  return (
    <Disclosure label="Change the operating configuration" tone="neutral">
      <ActionForm
        variant="secondary"
        submitLabel="Save"
        action={async (formData) => setOperatingConfigAction(caseFileId, slug, formData)}
      >
        <div>
          <label className={labelClass} htmlFor={`industry-${caseFileId}`}>
            Industry template
          </label>
          <select
            id={`industry-${caseFileId}`}
            name="industry_key"
            defaultValue={currentIndustryKey}
            className={selectClass}
          >
            {templates.map((template) => (
              <option key={template.key} value={template.key}>
                {template.name}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs leading-relaxed text-neutral-500">
            Changes what operators on this client are asked at the end of every shift. Reports already filed
            keep the fields they were filed with.
          </p>
        </div>

        <div>
          <label className={labelClass} htmlFor={`qualified-${caseFileId}`}>
            What counts as a qualified booking
          </label>
          <textarea
            id={`qualified-${caseFileId}`}
            name="qualified_booking_definition"
            rows={3}
            defaultValue={currentDefinition ?? ''}
            className={inputClass}
            placeholder="A consult booked with a confirmed time, a named treatment interest, and a reachable phone number."
          />
          <p className="mt-1.5 text-xs leading-relaxed text-neutral-500">
            The sentence an operator is measured against, and the one a disputed booking is settled with. Left
            blank it stays as the template&apos;s suggestion.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor={`role-${caseFileId}`}>
              Escalation contact role
            </label>
            <input
              id={`role-${caseFileId}`}
              name="contact_role"
              defaultValue={currentContactRole ?? ''}
              className={inputClass}
              placeholder="Clinical director"
            />
          </div>
          <div>
            <label className={labelClass} htmlFor={`channel-${caseFileId}`}>
              How to reach them
            </label>
            <input
              id={`channel-${caseFileId}`}
              name="contact_channel"
              defaultValue={currentContactChannel ?? ''}
              className={inputClass}
              placeholder="WhatsApp"
            />
          </div>
        </div>
      </ActionForm>
    </Disclosure>
  );
}
