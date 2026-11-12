import { describe, expect, it } from 'vitest';
import {
  MANAGEMENT_FEE,
  clientTotal,
  operatorEarnings,
  operatorStatement,
  shiftPay,
  hoursLabel,
  money,
  payFromRate,
  receiptOutputs,
  shiftWeek,
  startingHours,
  totalHours,
  weekLabel,
  weekTotals,
  weeklyReceipt,
  type WeekData,
  type WeekDay,
} from './week';

function day(date: string, status: string, numbers: WeekDay['numbers'] = [], extra: Partial<WeekDay> = {}): WeekDay {
  return {
    date,
    working: true,
    future: false,
    eod_id: null,
    status,
    hours_worked: null,
    hours_start: null,
    hours_end: null,
    break_minutes: null,
    wins: '',
    blockers: '',
    needs_help: false,
    was_late: false,
    numbers,
    ...extra,
  };
}

const texts = (value: number) => ({ group: 'Follow-up', label: 'Texts sent', unit: 'count', display: 'number' as const, value });
const dials = { group: 'GHL activity', label: 'Dials made', unit: 'count', display: 'pending_sync' as const, value: null };

const data: WeekData = {
  placements: [],
  placement: {
    id: 'pl',
    operator_name: 'Matthew Locsin',
    operator_email: 'operator@example.com',
    stripe_linked: true,
    client_name: 'Bay Area Cleaning Pros',
    time_zone: 'America/Chicago',
    shift_start: '09:00',
    shift_end: '13:00',
    shift_hours: 4,
    working_days: [1, 2, 3, 4, 5],
  },
  week_start: '2026-11-09',
  week_end: '2026-11-15',
  today: '2026-11-11',
  days: [
    day('2026-11-09', 'submitted', [texts(49), dials], { wins: 'Booked a <walkthrough> & two callbacks' }),
    day('2026-11-10', 'submitted', [texts(75), dials]),
    day('2026-11-11', 'excused', [texts(0), dials]),
  ],
  recipients: { to: ['client@example.com'], cc: [] },
  last_rate: null,
  charge: null,
  history: [],
};

describe('weekly billing', () => {
  it('starts reported days at the shift length and unreported days at zero', () => {
    expect(startingHours(data.days[0], 4)).toBe(4);
    expect(startingHours(data.days[2], 4)).toBe(0);
    expect(startingHours(day('2026-11-12', 'submitted', [], { hours_worked: 3.5 }), 4)).toBe(3.5);
    const saved = { days: [{ date: '2026-11-09', hours: 2 }] } as unknown as NonNullable<WeekData['charge']>;
    expect(startingHours(data.days[0], 4, saved)).toBe(2);
  });

  it('sums outputs across the week and keeps unsynced numbers pending', () => {
    const totals = weekTotals(data.days);
    expect(totals.find((row) => row.label === 'Texts sent')).toMatchObject({ value: 124, pending: false });
    expect(totals.find((row) => row.label === 'Dials made')).toMatchObject({ value: null, pending: true });
    expect(receiptOutputs(data.days).map((row) => row.label)).toEqual(['Texts sent']);
  });

  it('computes pay and formats money, hours, and the week', () => {
    expect(totalHours({ a: 4, b: 4, c: 0.25 })).toBe(8.25);
    expect(payFromRate(8, 15.5)).toBe(124);
    expect(payFromRate(8, null)).toBeNull();
    expect(money(1234.5)).toBe('$1,234.50');
    expect(hoursLabel(1)).toBe('1 hr');
    expect(hoursLabel(8)).toBe('8 hrs');
    expect(weekLabel('2026-11-09', '2026-11-15')).toBe('Nov 9 – 15, 2026');
    expect(weekLabel('2026-11-30', '2026-12-06')).toBe('Nov 30 – Dec 6, 2026');
    expect(shiftWeek('2026-11-09', -1)).toBe('2026-11-02');
  });

  it('builds the receipt with pay, the management fee, hours, outputs, and escaped wins', () => {
    const receipt = weeklyReceipt(data, {
      hours: { '2026-11-09': 4, '2026-11-10': 4, '2026-11-11': 0 },
      hourlyRate: 15,
      operatorPay: 120,
      commission: 0,
      managementFee: MANAGEMENT_FEE,
      note: '',
    });
    expect(receipt.subject).toBe('Weekly receipt: Matthew Locsin for Bay Area Cleaning Pros, Nov 9 – 15, 2026');
    expect(receipt.html).toContain('$220.00');
    expect(receipt.html).toContain('8 hrs × $15.00/hr');
    expect(receipt.html).toContain('Commission earnings');
    expect(receipt.html).toContain('Divine Acquisition management fee');
    expect(receipt.html).toContain('Texts sent');
    expect(receipt.html).not.toContain('Dials made');
    expect(receipt.html).toContain('Booked a &lt;walkthrough&gt; &amp; two callbacks');
    expect(receipt.text).toContain('Total for the week: $220.00');
    expect(receipt.text).toContain('- Texts sent: 124');
    expect(receipt.text).toContain('- Monday, Nov 9: 4 hrs, $60.00');
  });

  it('describes pay as hours worked when the pay was typed in', () => {
    const receipt = weeklyReceipt(data, { hours: { '2026-11-09': 4 }, hourlyRate: 15, operatorPay: 200, commission: 0, managementFee: 100, note: 'Thanks!' });
    expect(receipt.html).toContain('4 hrs worked');
    expect(receipt.html).toContain('$300.00');
    expect(receipt.text).toContain('Thanks!');
  });

  it('splits 18 hours and $72.66 across shifts to the cent', () => {
    const hours = { '2026-11-02': 2, '2026-11-03': 4, '2026-11-04': 4, '2026-11-05': 4, '2026-11-06': 4 };
    const pays = shiftPay(hours, 72.66);
    expect(pays['2026-11-02']).toBe(8.07);
    expect(Object.values(pays).reduce((sum, value) => Math.round((sum + value) * 100) / 100, 0)).toBe(72.66);
    expect(Object.values(pays).filter((value) => value === 16.15)).toHaveLength(3);
    expect(shiftPay({ a: 0 }, 50)).toEqual({ a: 0 });
  });

  it('charges the client pay + commission + fee, and shows the operator only their pay and commission', () => {
    const entry = {
      hours: { '2026-11-09': 2, '2026-11-10': 4, '2026-11-11': 4 },
      hourlyRate: null,
      operatorPay: 72.66,
      commission: 0,
      managementFee: 100,
      note: '',
    };
    expect(clientTotal(entry)).toBe(172.66);
    expect(operatorEarnings(entry)).toBe(72.66);

    const client = weeklyReceipt(data, entry, { amount: 172.66, at: '2026-11-12T18:00:00Z', invoiceUrl: 'https://invoice.stripe.com/i/x' });
    expect(client.html).toContain('$172.66');
    expect(client.html).toContain('Charged to your card on file');
    expect(client.html).toContain('https://invoice.stripe.com/i/x');

    const operator = operatorStatement(data, entry);
    expect(operator.subject).toBe('Your pay for Nov 9 – 15, 2026: $72.66');
    expect(operator.html).not.toContain('management fee');
    expect(operator.html).not.toContain('172.66');
    expect(operator.html).not.toContain('Commission');
    expect(operator.text).not.toMatch(/management|172\.66/i);

    const withCommission = operatorStatement(data, { ...entry, commission: 25 });
    expect(withCommission.html).toContain('Commission earned');
    expect(withCommission.subject).toContain('$97.66');
  });
});
