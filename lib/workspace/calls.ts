export const CALL_STATUSES = ['scheduled', 'in_progress', 'booked', 'not_booked', 'no_show'] as const;
export type CallStatus = (typeof CALL_STATUSES)[number];

export const PRACTICE_TYPES = ['dental', 'med_spa', 'both'] as const;
export type PracticeType = (typeof PRACTICE_TYPES)[number];

export const CALL_ROLES = ['owner', 'practice_manager', 'other'] as const;
export type CallRole = (typeof CALL_ROLES)[number];

export const FRONT_DESK_SIZES = ['one', 'two', 'three_plus'] as const;
export type FrontDeskSize = (typeof FRONT_DESK_SIZES)[number];

export type CallRecord = {
  id: string;
  created_at: string;
  updated_at: string;
  contact_name: string;
  practice_name: string;
  practice_type: PracticeType;
  role: CallRole;
  front_desk_size: FrontDeskSize;
  stated_pain: string | null;
  phone: string | null;
  email: string | null;
  source: string | null;
  status: CallStatus;
  outcome_note: string | null;
  audit_booked_at: string | null;
  calendar_token: string | null;
  calendar_sent_at: string | null;
};

export type CallAnswer = {
  id: string;
  call_id: string;
  question_key: string;
  answer_text: string | null;
  flagged: boolean;
};

export type FitTone = 'green' | 'amber' | 'red';

export type FitCheck = {
  key: 'decision_maker' | 'front_desk' | 'pain';
  label: string;
  tone: FitTone;
};

export const STAGE_PROGRESS_KEY = 'stage_progress';

export const CALL_STAGE_IDS = ['open', 'understand', 'reflect', 'book'] as const;
export type CallStageId = (typeof CALL_STAGE_IDS)[number];

export type CallQuestion = {
  key: string;
  label: string;
  flaggable: boolean;
};

export type CallStage = {
  id: CallStageId;
  title: string;
  duration: string;
  instruction: string;
  prompts: string[];
  questions: CallQuestion[];
  objections?: { ifTheySay: string; respond: string }[];
};

export type StageProgress = {
  open: CallStageId;
  completed: CallStageId[];
};

export const CALL_STAGES: CallStage[] = [
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
      'Walk me through what happens right now when someone calls and nobody can pick up.',
      'Who is responsible for calling back patients who haven\'t been in for a while?',
      'When someone comes in for a consult and doesn\'t book, what happens next?',
    ],
    questions: [
      { key: 'missed_call_process', label: 'What happens to a missed call?', flaggable: true },
      { key: 'recall_owner', label: 'Who owns recall follow-up?', flaggable: true },
      { key: 'consult_followup', label: 'What happens after an unconverted consult?', flaggable: true },
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
      'That is the same thing I see in most practices this size. It is not a staffing problem, there is just no version of that day where follow-up fits.',
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
        ifTheySay: 'I need to talk to my partner.',
        respond:
          'Makes sense. Book the time and bring them, or I can send the findings after and you can go through it together.',
      },
      {
        ifTheySay: 'Send me some information.',
        respond:
          'I can, but the useful version of this is specific to your practice, and that takes the thirty minutes. Which of those two days is easier?',
      },
      {
        ifTheySay: 'We already have someone doing this.',
        respond:
          'Good. Then the audit either confirms it is working or shows you where it is not. Either one is worth half an hour.',
      },
    ],
  },
];

export const CAPTURE_QUESTION_KEYS = CALL_STAGES.flatMap((stage) => stage.questions.map((q) => q.key));

export function isCallStageId(value: string): value is CallStageId {
  return (CALL_STAGE_IDS as readonly string[]).includes(value);
}

export function isCallStatus(value: string): value is CallStatus {
  return (CALL_STATUSES as readonly string[]).includes(value);
}

export function practiceTypeLabel(type: PracticeType): string {
  switch (type) {
    case 'dental':
      return 'Dental';
    case 'med_spa':
      return 'Med spa';
    case 'both':
      return 'Both';
  }
}

export function callRoleLabel(role: CallRole): string {
  switch (role) {
    case 'owner':
      return 'Owner';
    case 'practice_manager':
      return 'Practice manager';
    case 'other':
      return 'Other';
  }
}

export function frontDeskLabel(size: FrontDeskSize): string {
  switch (size) {
    case 'one':
      return '1';
    case 'two':
      return '2';
    case 'three_plus':
      return '3+';
  }
}

export function callStatusLabel(status: CallStatus): string {
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

/** Status badge colours from the call-workspace brief. Local to this surface. */
export function callStatusColor(status: CallStatus): string {
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

export function fitChecks(call: Pick<CallRecord, 'role' | 'front_desk_size' | 'stated_pain'>): FitCheck[] {
  const painNamed = Boolean(call.stated_pain && call.stated_pain.trim());
  return [
    {
      key: 'decision_maker',
      label: 'Decision maker',
      tone: call.role === 'owner' ? 'green' : call.role === 'practice_manager' ? 'amber' : 'red',
    },
    {
      key: 'front_desk',
      label: 'Front desk size',
      tone: call.front_desk_size === 'three_plus' ? 'amber' : 'green',
    },
    {
      key: 'pain',
      label: 'Pain named',
      tone: painNamed ? 'green' : 'red',
    },
  ];
}

export function parseStageProgress(raw: string | null | undefined): StageProgress {
  const fallback: StageProgress = { open: 'open', completed: [] };
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as Partial<StageProgress>;
    const open = typeof parsed.open === 'string' && isCallStageId(parsed.open) ? parsed.open : 'open';
    const completed = Array.isArray(parsed.completed)
      ? parsed.completed.filter((id): id is CallStageId => typeof id === 'string' && isCallStageId(id))
      : [];
    return { open, completed };
  } catch {
    return fallback;
  }
}

export function nextStageId(current: CallStageId): CallStageId | null {
  const index = CALL_STAGE_IDS.indexOf(current);
  if (index < 0 || index >= CALL_STAGE_IDS.length - 1) return null;
  return CALL_STAGE_IDS[index + 1];
}

export function blankToNull(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed ? trimmed : null;
}

export function matchesCallSearch(call: Pick<CallRecord, 'contact_name' | 'practice_name'>, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return call.contact_name.toLowerCase().includes(q) || call.practice_name.toLowerCase().includes(q);
}
