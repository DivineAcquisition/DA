'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { CLEANING_SUBMIT, cleaningConsent } from '@/lib/cleaning/copy';
import {
  ANSWERS_LEADS_OPTIONS,
  BUDGET_OPTIONS,
  RECURRING_OPTIONS,
  REVENUE_OPTIONS,
} from '@/lib/cleaning/lead';
import { cleaningSettings } from '@/lib/cleaning/settings';
import { captureVisitAttribution, nicheTrackingFromSearch, withNicheTracking } from '@/lib/acq/niche-tracking';
import { trackCleaningLead } from './Pixel';

export function AuditForm() {
  const [error, setError] = useState('');
  const [field, setField] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    captureVisitAttribution(nicheTrackingFromSearch(new URLSearchParams(window.location.search)));
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError('');
    setField('');
    const form = new FormData(event.currentTarget);
    const firstName = String(form.get('firstName') ?? '');
    const tracking = captureVisitAttribution(nicheTrackingFromSearch(new URLSearchParams(window.location.search)));
    setPending(true);
    try {
      const response = await fetch('/api/go/cleaning-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          firstName,
          phone: form.get('phone'),
          email: form.get('email'),
          company: form.get('company'),
          serviceArea: form.get('serviceArea'),
          monthlyRevenue: form.get('monthlyRevenue'),
          recurringShare: form.get('recurringShare'),
          answersLeads: form.get('answersLeads'),
          adBudget: form.get('adBudget'),
          website: form.get('website'),
          tracking,
        }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        error?: string;
        field?: string;
        eventId?: string;
        monthlyRevenue?: string;
        recurringShare?: string;
      };
      if (!result.ok) {
        setError(result.error || 'We could not submit that just now. Try again in a moment.');
        setField(result.field || '');
        setPending(false);
        return;
      }
      if (result.eventId && result.monthlyRevenue && result.recurringShare) {
        trackCleaningLead(result.monthlyRevenue, result.recurringShare, result.eventId);
      }
      const next = withNicheTracking(
        `/cleaning/thanks?name=${encodeURIComponent(firstName.trim())}`,
        tracking,
      );
      window.location.assign(next);
    } catch {
      setError('We could not submit that just now. Try again in a moment.');
      setPending(false);
    }
  }

  return (
    <form id="request" className="clean-form" onSubmit={onSubmit} noValidate>
      <label>
        First name
        <input name="firstName" autoComplete="given-name" required aria-invalid={field === 'firstName'} />
      </label>
      <label>
        Mobile phone
        <input name="phone" type="tel" inputMode="tel" autoComplete="tel" required aria-invalid={field === 'phone'} />
      </label>
      <label>
        Email
        <input name="email" type="email" inputMode="email" autoComplete="email" required aria-invalid={field === 'email'} />
      </label>
      <label>
        Company name
        <input name="company" autoComplete="organization" required aria-invalid={field === 'company'} />
      </label>
      <label>
        Service area (city or county)
        <input name="serviceArea" required aria-invalid={field === 'serviceArea'} />
      </label>
      <label>
        Monthly revenue
        <select name="monthlyRevenue" defaultValue="" required aria-invalid={field === 'monthlyRevenue'}>
          <option value="" disabled>
            Select
          </option>
          {REVENUE_OPTIONS.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      </label>
      <label>
        How much of your revenue is recurring?
        <select name="recurringShare" defaultValue="" required aria-invalid={field === 'recurringShare'}>
          <option value="" disabled>
            Select
          </option>
          {RECURRING_OPTIONS.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      </label>
      <label>
        Who answers new leads today?
        <select name="answersLeads" defaultValue="" required aria-invalid={field === 'answersLeads'}>
          <option value="" disabled>
            Select
          </option>
          {ANSWERS_LEADS_OPTIONS.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      </label>
      <label>
        Can you put {cleaningSettings.minimumAdBudget} a month into ads?
        <select name="adBudget" defaultValue="" required aria-invalid={field === 'adBudget'}>
          <option value="" disabled>
            Select
          </option>
          {BUDGET_OPTIONS.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      </label>
      <label className="clean-hp" aria-hidden>
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      {error ? (
        <p className="clean-error" role="alert">
          {error}
        </p>
      ) : null}
      <button className="acq-button" type="submit" disabled={pending}>
        {pending ? 'Sending…' : CLEANING_SUBMIT}
      </button>
      <p className="clean-consent">{cleaningConsent()}</p>
    </form>
  );
}
