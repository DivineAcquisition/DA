export const HS_CALL_STATUSES = ['scheduled', 'in_progress', 'booked', 'not_booked', 'no_show'] as const;
export type HsCallStatus = (typeof HS_CALL_STATUSES)[number];

export const HS_TRADES = [
  'hvac',
  'plumbing',
  'electrical',
  'roofing',
  'cleaning',
  'landscaping',
  'pest',
  'garage_doors',
  'multi_trade',
  'other',
] as const;
export type HsTrade = (typeof HS_TRADES)[number];

export const HS_CALL_ROLES = ['owner', 'general_manager', 'office_manager', 'other'] as const;
export type HsCallRole = (typeof HS_CALL_ROLES)[number];

export const HS_CREW_COUNTS = ['owner_only', 'two_to_four', 'five_to_ten', 'ten_plus'] as const;
export type HsCrewCount = (typeof HS_CREW_COUNTS)[number];

export const HS_PHONE_COVERAGE = ['owner', 'one_admin', 'two_plus_admin', 'answering_service', 'nobody'] as const;
export type HsPhoneCoverage = (typeof HS_PHONE_COVERAGE)[number];

export type HsCallRecord = {
  id: string;
  created_at: string;
  updated_at: string;
  contact_name: string;
  company_name: string;
  trade: HsTrade;
  role: HsCallRole;
  crew_count: HsCrewCount;
  who_answers_phone: HsPhoneCoverage;
  stated_pain: string | null;
  phone: string | null;
  email: string | null;
  source: string | null;
  status: HsCallStatus;
  outcome_note: string | null;
  audit_booked_at: string | null;
  calendar_token: string | null;
  calendar_sent_at: string | null;
};

export type HsCallAnswer = {
  id: string;
  call_id: string;
  question_key: string;
  answer_text: string | null;
  flagged: boolean;
};

export type HsFitTone = 'green' | 'amber' | 'red';

export type HsFitCheck = {
  key: 'decision_maker' | 'phone_coverage' | 'size';
  label: string;
  tone: HsFitTone;
};

export const HS_STAGE_PROGRESS_KEY = 'stage_progress';

export const HS_CALL_STAGE_IDS = ['open', 'understand', 'reflect', 'book'] as const;
export type HsCallStageId = (typeof HS_CALL_STAGE_IDS)[number];

export type HsCallQuestion = {
  key: string;
  label: string;
  flaggable: boolean;
};

export type HsCallStage = {
  id: HsCallStageId;
  title: string;
  duration: string;
  instruction: string;
  prompts: string[];
  questions: HsCallQuestion[];
  objections?: { ifTheySay: string; respond: string }[];
};

export type HsStageProgress = {
  open: HsCallStageId;
  completed: HsCallStageId[];
};

export const HS_CALL_STAGES: HsCallStage[] = [
  {
    id: 'open',
    title: 'Open',
    duration: '2 minutes',
    instruction: 'Set the frame. Confirm the time. Do not pitch.',
    prompts: [
      'Thanks for making time. I have you down for fifteen minutes, does that still work?',
      'Before I ask anything, what made you fill out the form?',
    ],
    questions: [{ key: 'why_responded', label: 'What made them respond?', flaggable: false }],
  },
  {
    id: 'understand',
    title: 'Understand',
    duration: '6 minutes',
    instruction: 'Ask, then stop talking. The longest stage. Let them describe it.',
    prompts: [
      'Walk me through what happens when a call comes in while you are on a job.',
      'How long does it usually take before someone gets back to a new lead?',
      'When you quote a job and they do not book it, what happens after that?',
      'Who is calling last year\'s customers to get them back on the schedule?',
    ],
    questions: [
      { key: 'call_handling', label: 'What happens to a call during a job?', flaggable: true },
      { key: 'response_time', label: 'Actual time to first callback', flaggable: true },
      { key: 'unsold_estimates', label: 'What happens to a quote that does not close?', flaggable: true },
      { key: 'past_customers', label: 'Who works past customers?', flaggable: true },
      { key: 'tried_before', label: 'What have they already tried?', flaggable: true },
    ],
  },
  {
    id: 'reflect',
    title: 'Reflect',
    duration: '4 minutes',
    instruction: 'Say back what you heard. Do not solve it. Naming it accurately is what earns the next call.',
    prompts: [
      'So if I have this right: [restate their words, not your framing].',
      'That is what I see in most companies your size. It is not that nobody cares, it is that the person who would make those calls is the same person running the jobs.',
      'I am not going to try to fix that in the next four minutes.',
    ],
    questions: [],
  },
  {
    id: 'book',
    title: 'Book',
    duration: '3 minutes',
    instruction: 'Offer the audit as the next step. Give two times. Do not ask whether they want to book.',
    prompts: [
      'The next step is a thirty-minute audit where we go through your actual numbers together.',
      'You keep whatever we find either way.',
      'I have [day] or [day]. Which works better?',
    ],
    questions: [],
    objections: [
      {
        ifTheySay: 'What does it cost?',
        respond:
          'Nothing for the audit. If we work together after that I will walk you through it then, but that is not what this is.',
      },
      {
        ifTheySay: 'I am slammed right now.',
        respond:
          'That is usually when this is worth thirty minutes. Busy season is when the callbacks slip. I have [day] early or [day] after five.',
      },
      {
        ifTheySay: 'Send me some information.',
        respond:
          'I can, but the useful version of this is specific to your company, and that takes the thirty minutes. Which of those two days is easier?',
      },
      {
        ifTheySay: 'We already have someone doing marketing.',
        respond:
          'Good. This is not marketing. It is what happens after the phone rings. The audit either confirms that part is working or shows you where it is not.',
      },
      {
        ifTheySay: 'My wife handles the office.',
        respond:
          'Then bring her. It is worth both of you being on it, since she will see things I would miss.',
      },
    ],
  },
];

export const HS_CAPTURE_QUESTION_KEYS = HS_CALL_STAGES.flatMap((stage) => stage.questions.map((q) => q.key));

export function isHsCallStageId(value: string): value is HsCallStageId {
  return (HS_CALL_STAGE_IDS as readonly string[]).includes(value);
}

export function isHsCallStatus(value: string): value is HsCallStatus {
  return (HS_CALL_STATUSES as readonly string[]).includes(value);
}

export function isHsTrade(value: string): value is HsTrade {
  return (HS_TRADES as readonly string[]).includes(value);
}

export function isHsCallRole(value: string): value is HsCallRole {
  return (HS_CALL_ROLES as readonly string[]).includes(value);
}

export function isHsCrewCount(value: string): value is HsCrewCount {
  return (HS_CREW_COUNTS as readonly string[]).includes(value);
}

export function isHsPhoneCoverage(value: string): value is HsPhoneCoverage {
  return (HS_PHONE_COVERAGE as readonly string[]).includes(value);
}

export function hsTradeLabel(trade: HsTrade): string {
  switch (trade) {
    case 'hvac':
      return 'HVAC';
    case 'plumbing':
      return 'Plumbing';
    case 'electrical':
      return 'Electrical';
    case 'roofing':
      return 'Roofing';
    case 'cleaning':
      return 'Cleaning';
    case 'landscaping':
      return 'Landscaping';
    case 'pest':
      return 'Pest control';
    case 'garage_doors':
      return 'Garage doors';
    case 'multi_trade':
      return 'Multi-trade';
    case 'other':
      return 'Other';
  }
}

export function hsCallRoleLabel(role: HsCallRole): string {
  switch (role) {
    case 'owner':
      return 'Owner';
    case 'general_manager':
      return 'General manager';
    case 'office_manager':
      return 'Office manager';
    case 'other':
      return 'Other';
  }
}

export function hsCrewCountLabel(count: HsCrewCount): string {
  switch (count) {
    case 'owner_only':
      return 'Owner only';
    case 'two_to_four':
      return '2–4';
    case 'five_to_ten':
      return '5–10';
    case 'ten_plus':
      return '10+';
  }
}

export function hsPhoneCoverageLabel(coverage: HsPhoneCoverage): string {
  switch (coverage) {
    case 'owner':
      return 'Owner';
    case 'one_admin':
      return 'One admin';
    case 'two_plus_admin':
      return 'Two or more admins';
    case 'answering_service':
      return 'Answering service';
    case 'nobody':
      return 'Nobody';
  }
}

export function hsCallStatusLabel(status: HsCallStatus): string {
  switch (status) {
    case 'scheduled':
      return 'Scheduled';
    case 'in_progress':
      return 'In progress';
    case 'booked':
      return 'Booked';
    case 'not_booked':
      return 'Not booked';
    case 'no_show':
      return 'No show';
  }
}

export function hsCallStatusColor(status: HsCallStatus): string {
  switch (status) {
    case 'scheduled':
      return '#6E6C80';
    case 'in_progress':
      return '#FFD06A';
    case 'booked':
      return '#7AFF8A';
    case 'not_booked':
    case 'no_show':
      return '#FF6A6A';
  }
}

export function hsFitChecks(
  call: Pick<HsCallRecord, 'role' | 'who_answers_phone' | 'crew_count'>,
): HsFitCheck[] {
  const phoneTone: HsFitTone =
    call.who_answers_phone === 'two_plus_admin'
      ? 'red'
      : call.who_answers_phone === 'answering_service'
        ? 'amber'
        : 'green';
  const sizeTone: HsFitTone =
    call.crew_count === 'owner_only' ? 'red' : call.crew_count === 'ten_plus' ? 'amber' : 'green';
  return [
    {
      key: 'decision_maker',
      label: 'Decision maker',
      tone: call.role === 'owner' ? 'green' : call.role === 'general_manager' ? 'amber' : 'red',
    },
    {
      key: 'phone_coverage',
      label: 'Phone coverage',
      tone: phoneTone,
    },
    {
      key: 'size',
      label: 'Size',
      tone: sizeTone,
    },
  ];
}

export function parseHsStageProgress(raw: string | null | undefined): HsStageProgress {
  const fallback: HsStageProgress = { open: 'open', completed: [] };
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as Partial<HsStageProgress>;
    const open = typeof parsed.open === 'string' && isHsCallStageId(parsed.open) ? parsed.open : 'open';
    const completed = Array.isArray(parsed.completed)
      ? parsed.completed.filter((id): id is HsCallStageId => typeof id === 'string' && isHsCallStageId(id))
      : [];
    return { open, completed };
  } catch {
    return fallback;
  }
}

export function nextHsStageId(current: HsCallStageId): HsCallStageId | null {
  const index = HS_CALL_STAGE_IDS.indexOf(current);
  if (index < 0 || index >= HS_CALL_STAGE_IDS.length - 1) return null;
  return HS_CALL_STAGE_IDS[index + 1];
}

export function blankToNull(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed ? trimmed : null;
}

export function matchesHsCallSearch(
  call: Pick<HsCallRecord, 'contact_name' | 'company_name'>,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return call.contact_name.toLowerCase().includes(q) || call.company_name.toLowerCase().includes(q);
}
