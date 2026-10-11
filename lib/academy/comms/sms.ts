export type SmsTemplate = {
  id: string;
  body: string;
  /** First message of a series. Carries the opt-out line. */
  optIn?: boolean;
};

export const SMS: SmsTemplate[] = [
  {
    id: 'S00',
    optIn: true,
    body: "DA Academy: You're signed up for text updates about your training. Msgs ~2/wk. Msg and data rates may apply. Reply STOP to opt out, HELP for help.",
  },
  { id: 'S01', body: 'DA Academy: [First name], your access is open. Start Module 1 here: [Link]' },
  { id: 'S02', body: 'DA Academy: [First name], your next step is [Next step name] (about [Minutes] min). Pick it up here: [Link]' },
  { id: 'S03', body: 'DA Academy: [First name], your call with [Manager name] is [Date] at [Time]. Reply here if you need to change it.' },
  { id: 'S04', body: 'DA Academy: [First name], 2 minutes? Quick check-in on your first [Days] days: [Pulse link]' },
  { id: 'S05', body: 'Divine Acquisition: [First name], your interview is [Date] at [Time]. Link: [Link]. Reply STOP to opt out.' },
  { id: 'S06', body: 'DA Academy: [First name], your certification renews [Renewal date]. Start here: [Link]' },
  { id: 'S07', body: "DA Academy: You're unsubscribed and will not get more texts. Reply START to rejoin." },
  { id: 'S08', body: 'DA Academy: For help, email [Support email]. Msg and data rates may apply. Reply STOP to opt out.' },
];

export function smsTemplate(id: string): SmsTemplate | undefined {
  return SMS.find((template) => template.id === id);
}
