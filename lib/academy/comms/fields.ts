export type MergeFields = {
  firstName?: string;
  fullName?: string;
  managerName?: string;
  reviewerName?: string;
  supervisorName?: string;
  senderName?: string;
  clientContactFirstName?: string;
  operatorFirstName?: string;
  adminName?: string;
  program?: string;
  moduleNumber?: string | number;
  moduleName?: string;
  lessonName?: string;
  quizName?: string;
  simulationName?: string;
  /** Lesson name or quiz name, for the stalled Discord alert. */
  lessonOrQuiz?: string;
  nextStepName?: string;
  minutes?: string | number;
  targetDate?: string;
  attemptsUsed?: string | number;
  attemptsLeft?: string | number;
  attemptsMax?: string | number;
  /** Used when a template contains a single [Number]. */
  number?: string | number;
  /** Used in order when a template contains more than one [Number]. */
  numbers?: Array<string | number>;
  concepts?: string;
  date?: string;
  time?: string;
  timeZone?: string;
  days?: string | number;
  hours?: string | number;
  reviewDueDate?: string;
  retestDate?: string;
  startDate?: string;
  endDate?: string;
  renewalDate?: string;
  client?: string;
  vertical?: string;
  track?: string;
  level?: string;
  link?: string;
  adminLink?: string;
  certificateLink?: string;
  verifyLink?: string;
  pulseLink?: string;
  supportEmail?: string;
  companyAddress?: string;
  numberOfDays?: string | number;
  rolePing?: string;
  holdOutcome?: string;
  pulseParty?: string;
  placementStatus?: string;
  inviteRole?: string;
  adminReason?: string;
  previousModuleName?: string;
  previousLessonName?: string;
  requirementName?: string;
  concept?: string;
  lessonLink?: string;
};

const TOKEN_VALUES: Array<[string, (fields: MergeFields) => string | number | undefined]> = [
  ['[Admin writes a short, factual reason here, with no accusations.]', (f) => f.adminReason],
  ['[Simulation name or reflection]', (f) => f.simulationName],
  ['[Lesson name or Quiz name]', (f) => f.lessonOrQuiz],
  ['[Reset, Extend, or Release]', (f) => f.holdOutcome],
  ['[Client contact first name]', (f) => f.clientContactFirstName],
  ['[Operator first name]', (f) => f.operatorFirstName],
  ['[Operator or Client]', (f) => f.pulseParty],
  ['[Reviewer or Admin]', (f) => f.inviteRole],
  ['[Ready or Paused]', (f) => f.placementStatus],
  ['[Previous module name]', (f) => f.previousModuleName],
  ['[Previous lesson name]', (f) => f.previousLessonName],
  ['[Requirement name]', (f) => f.requirementName],
  ['[Certificate link]', (f) => f.certificateLink],
  ['[Number of days]', (f) => f.numberOfDays],
  ['[Review due date]', (f) => f.reviewDueDate],
  ['[Next step name]', (f) => f.nextStepName],
  ['[Company address]', (f) => f.companyAddress],
  ['[Supervisor name]', (f) => f.supervisorName],
  ['[Simulation name]', (f) => f.simulationName],
  ['[Module number]', (f) => f.moduleNumber],
  ['[Attempts used]', (f) => f.attemptsUsed],
  ['[Attempts left]', (f) => f.attemptsLeft],
  ['[Attempts max]', (f) => f.attemptsMax],
  ['[Support email]', (f) => f.supportEmail],
  ['[Renewal date]', (f) => f.renewalDate],
  ['[Retest date]', (f) => f.retestDate],
  ['[Reviewer name]', (f) => f.reviewerName],
  ['[Manager name]', (f) => f.managerName],
  ['[Target date]', (f) => f.targetDate],
  ['[Sender name]', (f) => f.senderName],
  ['[Lesson link]', (f) => f.lessonLink],
  ['[Start date]', (f) => f.startDate],
  ['[Module name]', (f) => f.moduleName],
  ['[Lesson name]', (f) => f.lessonName],
  ['[Admin name]', (f) => f.adminName],
  ['[Verify link]', (f) => f.verifyLink],
  ['[Pulse link]', (f) => f.pulseLink],
  ['[Admin link]', (f) => f.adminLink],
  ['[Time zone]', (f) => f.timeZone],
  ['[First name]', (f) => f.firstName],
  ['[Full name]', (f) => f.fullName],
  ['[Quiz name]', (f) => f.quizName],
  ['[End date]', (f) => f.endDate],
  ['[Concepts]', (f) => f.concepts],
  ['[Vertical or Track]', (f) => f.vertical || f.track],
  ['[Vertical]', (f) => f.vertical],
  ['[Concept]', (f) => f.concept],
  ['[Minutes]', (f) => f.minutes],
  ['[Program]', (f) => f.program],
  ['[Client]', (f) => f.client],
  ['[Number]', (f) => f.number],
  ['[Level]', (f) => f.level],
  ['[Track]', (f) => f.track],
  ['[Hours]', (f) => f.hours],
  ['[Days]', (f) => f.days],
  ['[Date]', (f) => f.date],
  ['[Time]', (f) => f.time],
  ['[Link]', (f) => f.link],
];

function present(value: string | number | undefined | null): value is string | number {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

/**
 * Replaces library tokens. Longer tokens are applied first so `[Number]`
 * cannot consume `[Number of days]`. Several `[Number]` tokens in one
 * template take `numbers` in order.
 */
export function fillMerge(template: string, fields: MergeFields): { text: string; missing: string[] } {
  let text = template;
  const missing: string[] = [];

  for (const [token, read] of TOKEN_VALUES) {
    if (token === '[Number]' || !text.includes(token)) continue;
    const value = read(fields);
    if (!present(value)) {
      missing.push(token);
      continue;
    }
    text = text.split(token).join(String(value));
  }

  if (text.includes('[Number]')) {
    const count = text.split('[Number]').length - 1;
    const values = count > 1 ? (fields.numbers ?? []) : present(fields.number) ? [fields.number] : [];
    let index = 0;
    text = text.replace(/\[Number\]/g, () => {
      const value = values[index];
      index += 1;
      if (!present(value)) {
        missing.push('[Number]');
        return '[Number]';
      }
      return String(value);
    });
  }

  if (text.includes('[Role ping]')) {
    const ping = fields.rolePing?.trim() ?? '';
    text = ping ? text.split('[Role ping]').join(ping) : text.replace(/\s*\[Role ping\]\s*/g, ' ');
  }

  text = text
    .split('\n')
    .map((line) => line.replace(/[ ]{2,}/g, ' ').replace(/\s+([.,])/g, '$1').trimEnd())
    .join('\n');

  return { text, missing: [...new Set(missing)] };
}

export function firstNameFrom(fullName: string | null | undefined): string {
  const trimmed = fullName?.trim() ?? '';
  if (!trimmed) return '';
  const first = trimmed.split(/\s+/)[0] ?? '';
  return first.length >= 2 ? first : trimmed;
}

/** A filled sample used to prove every template can render. */
export const SAMPLE_FIELDS: MergeFields = {
  firstName: 'Amina',
  fullName: 'Amina Cole',
  managerName: 'Malik',
  reviewerName: 'Jordan',
  supervisorName: 'Riley',
  senderName: 'Malik',
  clientContactFirstName: 'Priya',
  operatorFirstName: 'Amina',
  adminName: 'Malik',
  program: 'DA Operator Academy',
  moduleNumber: 3,
  moduleName: 'The DA Standard',
  lessonName: 'Who DA Is',
  quizName: 'Module 3 quiz',
  simulationName: 'Discovery call',
  lessonOrQuiz: 'Module 3 quiz',
  nextStepName: 'Module 3: Lesson 2',
  minutes: 20,
  targetDate: 'Oct 18, 2026',
  attemptsUsed: 5,
  attemptsLeft: 2,
  attemptsMax: 5,
  number: 2,
  numbers: [12, 3, 1, 0, 4, 2, 6, 1, 5],
  concepts: 'pricing, discovery',
  date: 'Oct 11, 2026',
  time: '10:30 AM',
  timeZone: 'ET',
  days: 7,
  hours: 26,
  reviewDueDate: 'Oct 14, 2026',
  retestDate: 'Oct 20, 2026',
  startDate: 'Oct 21, 2026',
  endDate: 'Nov 21, 2026',
  renewalDate: 'Oct 11, 2027',
  client: 'Northshore Med Spa',
  vertical: 'Med Spa',
  track: 'Internal closer',
  level: 'Level 1: Certified Operator',
  link: 'https://training.divineacquisition.io/academy',
  adminLink: 'https://app.divineacquisition.io/workspace/academy/holds/1',
  certificateLink: 'https://training.divineacquisition.io/academy/certificate/abc',
  verifyLink: 'https://training.divineacquisition.io/verify/abc',
  pulseLink: 'https://training.divineacquisition.io/pulse/abc',
  supportEmail: 'academy@divineacquisition.io',
  companyAddress: '7404 Executive Place, Lanham, MD 20706',
  numberOfDays: 2,
  rolePing: '@academy-managers',
  holdOutcome: 'Reset',
  pulseParty: 'Operator',
  placementStatus: 'Ready',
  inviteRole: 'Reviewer',
  adminReason: 'The certification was issued on an enrollment that has since been withdrawn.',
  previousModuleName: 'Who DA Is',
  previousLessonName: 'The offer',
  requirementName: 'Practical',
  concept: 'discovery',
  lessonLink: 'https://training.divineacquisition.io/academy/modules/3/lessons/2',
};
