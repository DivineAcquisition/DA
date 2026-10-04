export const ACADEMY_STATES = [
  'signed_out',
  'no_access',
  'no_enrollment',
  'agreement_pending',
  'on_hold',
  'invited',
  'active',
  'stalled',
  'completed',
] as const;

export type AcademyState = (typeof ACADEMY_STATES)[number];

export type AcademyModuleDisplay =
  | 'locked'
  | 'available'
  | 'in_progress'
  | 'complete'
  | 'unpublished'
  | 'lessons_complete'
  | 'quiz_available'
  | 'quiz_passed_pending';

export type AcademyQuizStatus = 'not_available' | 'available' | 'in_progress' | 'locked' | 'passed' | 'on_hold';

export type AcademyQuizCard = {
  quizId: string;
  kind: string;
  status: AcademyQuizStatus;
  attemptsUsed: number;
  attemptsAllowed: number;
  attemptsRemaining: number;
  lockoutUntil: string | null;
  highestScore: number | null;
  questionCount: number;
  passMark: number;
  passMarkUnit: string;
  passedAt: string | null;
};

export type AcademyGateCard = {
  id: string;
  key: string;
  label: string;
  status: 'satisfied' | 'pending';
};

export type AcademyModule = {
  id: string;
  order: number;
  title: string;
  description: string;
  required: boolean;
  gateType: string;
  gateDetail: string | null;
  display: AcademyModuleDisplay;
  openable: boolean;
  quiz: AcademyQuizCard | null;
  gates: AcademyGateCard[];
};

export type AcademyShell = {
  state: AcademyState;
  program: { id: string; name: string; type: string; version: number; status: string } | null;
  enrollment: {
    id: string;
    status: string;
    track: string;
    startDate: string | null;
    targetDate: string | null;
  } | null;
  certification: {
    level: number;
    label: string;
    vertical: string | null;
    grantedAt: string | null;
    recertifyOn: string | null;
  } | null;
  progress: { completed: number; total: number; percent: number; unit: 'lessons' | 'modules' };
  currentModule: { id: string; order: number; title: string } | null;
  nextAction: { title: string; detail: string; href: string | null } | null;
  banner: string | null;
  modules: AcademyModule[];
};

export function academyContentOpen(state: AcademyState): boolean {
  return state === 'active' || state === 'stalled' || state === 'completed';
}
