'use client';

import { inputClass, labelClass, selectClass } from '@/app/vistrial/components/ui';
import {
  endPlacementAction,
  placeSalesOperatorAction,
  saveEngagementDetailsAction,
  syncStripeRevenueAction,
} from '@/lib/da/actions';
import type { SalesOperatorChoice } from '@/lib/da/queries';
import { ActionForm, Disclosure } from './ActionForm';

const ZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
  'Pacific/Honolulu',
];

export function ClientDetailsForm({
  caseFileId,
  slug,
  startOpen,
  phone,
  billingEmail,
  offer,
  monthlyAdSpend,
  crmStack,
  timeZone,
  notes,
}: {
  caseFileId: string;
  slug: string;
  startOpen: boolean;
  phone: string | null;
  billingEmail: string | null;
  offer: string | null;
  monthlyAdSpend: string | null;
  crmStack: string | null;
  timeZone: string | null;
  notes: string | null;
}) {
  const zone = timeZone && ZONES.includes(timeZone) ? timeZone : timeZone ? 'other' : '';

  const form = (
      <ActionForm
        variant="secondary"
        submitLabel="Save details"
        action={async (formData) => saveEngagementDetailsAction(caseFileId, slug, formData)}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor={`phone-${caseFileId}`}>
              Phone
            </label>
            <input id={`phone-${caseFileId}`} name="phone" defaultValue={phone ?? ''} className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor={`billing-${caseFileId}`}>
              Billing email
            </label>
            <input
              id={`billing-${caseFileId}`}
              name="billing_email"
              type="email"
              defaultValue={billingEmail ?? ''}
              className={inputClass}
            />
          </div>
        </div>
        <div>
          <label className={labelClass} htmlFor={`offer-${caseFileId}`}>
            Offer
          </label>
          <textarea
            id={`offer-${caseFileId}`}
            name="offer"
            rows={3}
            defaultValue={offer ?? ''}
            className={inputClass}
            placeholder="What we install, and what the client is paying for."
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor={`spend-${caseFileId}`}>
              Monthly ad spend
            </label>
            <input
              id={`spend-${caseFileId}`}
              name="monthly_ad_spend"
              type="number"
              min="0"
              step="0.01"
              defaultValue={monthlyAdSpend ?? ''}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor={`crm-${caseFileId}`}>
              CRM / stack
            </label>
            <input
              id={`crm-${caseFileId}`}
              name="crm_stack"
              defaultValue={crmStack ?? ''}
              className={inputClass}
              placeholder="GoHighLevel, ServiceTitan"
            />
          </div>
        </div>
        <div>
          <label className={labelClass} htmlFor={`zone-${caseFileId}`}>
            Time zone
          </label>
          <select id={`zone-${caseFileId}`} name="time_zone" defaultValue={zone === 'other' ? timeZone ?? '' : zone} className={selectClass}>
            <option value="">Select a time zone</option>
            {ZONES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
            {zone === 'other' && timeZone && <option value={timeZone}>{timeZone}</option>}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor={`notes-${caseFileId}`}>
            Notes
          </label>
          <textarea id={`notes-${caseFileId}`} name="notes" rows={3} defaultValue={notes ?? ''} className={inputClass} />
        </div>
      </ActionForm>
  );
  if (startOpen) return form;
  return (
    <Disclosure label="Edit client details" tone="neutral">
      {form}
    </Disclosure>
  );
}

export function PlaceOperatorForm({
  caseFileId,
  slug,
  operators,
  timeZone,
  startOpen,
}: {
  caseFileId: string;
  slug: string;
  operators: SalesOperatorChoice[];
  timeZone: string | null;
  startOpen: boolean;
}) {
  const today = new Date().toISOString().slice(0, 10);

  if (operators.length === 0) {
    return (
      <p className="text-sm leading-relaxed text-neutral-400">
        No active sales-operator recipients yet. Add one under Agreements, then place them on this client.
      </p>
    );
  }

  const form = (
      <ActionForm
        submitLabel="Place operator"
        action={async (formData) => placeSalesOperatorAction(caseFileId, slug, formData)}
      >
          <div>
            <label className={labelClass} htmlFor={`operator-${caseFileId}`}>
              Sales operator
            </label>
            <select id={`operator-${caseFileId}`} name="email" required defaultValue="" className={selectClass}>
              <option value="" disabled>
                Choose an operator
              </option>
              {operators.map((operator) => (
                <option key={operator.email} value={operator.email}>
                  {operator.full_name} · {operator.email}
                </option>
              ))}
            </select>
          </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor={`start-${caseFileId}`}>
              Start date
            </label>
            <input
              id={`start-${caseFileId}`}
              name="start_date"
              type="date"
              required
              defaultValue={today}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor={`term-${caseFileId}`}>
              Term (months)
            </label>
            <input
              id={`term-${caseFileId}`}
              name="term_months"
              type="number"
              min="1"
              step="1"
              defaultValue={3}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor={`quota-${caseFileId}`}>
              Monthly booking quota
            </label>
            <input id={`quota-${caseFileId}`} name="quota" type="number" min="0" step="1" defaultValue={0} className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor={`commission-${caseFileId}`}>
              Commission per booking
            </label>
            <input
              id={`commission-${caseFileId}`}
              name="commission"
              type="number"
              min="0"
              step="0.01"
              defaultValue={0}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor={`rate-${caseFileId}`}>
              Client rate per booking
            </label>
            <input id={`rate-${caseFileId}`} name="client_rate" type="number" min="0" step="0.01" className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor={`place-zone-${caseFileId}`}>
              Time zone
            </label>
            <select
              id={`place-zone-${caseFileId}`}
              name="time_zone"
              defaultValue={timeZone && ZONES.includes(timeZone) ? timeZone : 'America/New_York'}
              className={selectClass}
            >
              {ZONES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-xs leading-relaxed text-neutral-500">
          Placing creates the operator record if they only exist as a recipient, then links them to this client
          for the term. Shift hours default to 09:00–18:00 in the time zone above.
        </p>
      </ActionForm>
  );
  if (startOpen) return form;
  return <Disclosure label="Place a sales operator">{form}</Disclosure>;
}

export function EndPlacementButton({ placementId, slug }: { placementId: string; slug: string }) {
  return (
    <ActionForm variant="secondary" submitLabel="End placement" action={async () => endPlacementAction(placementId, slug)}>
      <span className="sr-only">End the live placement</span>
    </ActionForm>
  );
}

export function RefreshStripeButton({ caseFileId, slug }: { caseFileId: string; slug: string }) {
  return (
    <Disclosure label="Refresh from Stripe" tone="neutral">
      <ActionForm variant="secondary" submitLabel="Refresh from Stripe" action={async () => syncStripeRevenueAction(caseFileId, slug)}>
        <p className="text-xs leading-relaxed text-neutral-500">
          Pulls paid invoices for the Stripe customer on this engagement. The server needs a Stripe key for a fresh
          pull. Payments already saved stay on the case file.
        </p>
      </ActionForm>
    </Disclosure>
  );
}
