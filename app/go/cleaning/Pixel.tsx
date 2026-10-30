'use client';

import { useEffect } from 'react';

type Fbq = (command: string, event: string, params?: Record<string, string>) => void;

function pixel(): Fbq | null {
  const fbq = (window as Window & { fbq?: Fbq }).fbq;
  return fbq ?? null;
}

const cleaning = { content_name: 'cleaning', content_category: 'cleaning' };

export function CleaningPageView() {
  useEffect(() => {
    pixel()?.('track', 'PageView', cleaning);
  }, []);
  return null;
}

export function trackCleaningLead(monthlyRevenue: string, recurringShare: string, eventId: string) {
  pixel()?.('track', 'Lead', {
    ...cleaning,
    content_name: 'cleaning',
    currency: 'USD',
    monthly_revenue: monthlyRevenue,
    recurring_share: recurringShare,
    event_id: eventId,
  });
}

export function CleaningCallback() {
  useEffect(() => {
    pixel()?.('trackCustom', 'Callback Requested', cleaning);
  }, []);
  return null;
}
