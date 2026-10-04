import {
  ACADEMY_STATES,
  type AcademyGateCard,
  type AcademyModule,
  type AcademyModuleDisplay,
  type AcademyQuizCard,
  type AcademyQuizStatus,
  type AcademyShell,
  type AcademyState,
} from './types';

export type RawAcademyShell = {
  state?: string;
  program?: { id?: string; name?: string; type?: string; version?: number; status?: string } | null;
  enrollment?: {
    id?: string;
    status?: string;
    track?: string;
    start_date?: string | null;
    target_date?: string | null;
  } | null;
  certification?: {
    level?: number;
    label?: string;
    vertical?: string | null;
    granted_at?: string | null;
    recertify_on?: string | null;
  } | null;
  progress?: { completed?: number; total?: number; percent?: number; unit?: string };
  current_module?: { id?: string; order?: number; title?: string } | null;
  next_action?: { title?: string; detail?: string; href?: string | null } | null;
  banner?: string | null;
  hold?: {
    manager_name?: string;
    opened_at?: string;
    review_started_at?: string | null;
    status?: string;
  } | null;
  remediation?: {
    hold_id?: string;
    outcome?: string;
    plan?: string;
    attempts_granted?: number;
    retest_on?: string | null;
    acknowledged_at?: string | null;
    lessons?: { id?: string; title?: string; code?: string; module_id?: string; reopened?: boolean }[];
    modules?: { id?: string; order?: number; title?: string; reopened?: boolean }[];
  } | null;
  modules?: {
    id?: string;
    order?: number;
    title?: string;
    description?: string;
    required?: boolean;
    gate_type?: string;
    gate_detail?: string | null;
    display?: string;
    openable?: boolean;
    quiz?: {
      quiz_id?: string;
      kind?: string;
      status?: string;
      attempts_used?: number;
      attempts_allowed?: number;
      attempts_remaining?: number;
      lockout_until?: string | null;
      retry_block?: string | null;
      retest_on?: string | null;
      highest_score?: number | null;
      question_count?: number;
      pass_mark?: number;
      pass_mark_unit?: string;
      passed_at?: string | null;
    } | null;
    gates?: { id?: string; key?: string; label?: string; status?: string }[];
  }[];
};

const DISPLAYS: AcademyModuleDisplay[] = [
  'locked',
  'available',
  'in_progress',
  'complete',
  'unpublished',
  'lessons_complete',
  'quiz_available',
  'quiz_passed_pending',
];

const QUIZ_STATUSES: AcademyQuizStatus[] = ['not_available', 'available', 'in_progress', 'locked', 'passed', 'on_hold'];

function asQuiz(raw: NonNullable<NonNullable<RawAcademyShell['modules']>[number]['quiz']> | null | undefined): AcademyQuizCard | null {
  if (!raw?.quiz_id || !QUIZ_STATUSES.includes(raw.status as AcademyQuizStatus)) return null;
  return {
    quizId: raw.quiz_id,
    kind: raw.kind ?? 'module',
    status: raw.status as AcademyQuizStatus,
    attemptsUsed: raw.attempts_used ?? 0,
    attemptsAllowed: raw.attempts_allowed ?? 0,
    attemptsRemaining: raw.attempts_remaining ?? 0,
    lockoutUntil: raw.lockout_until ?? null,
    highestScore: raw.highest_score ?? null,
    questionCount: raw.question_count ?? 0,
    passMark: raw.pass_mark ?? 0,
    passMarkUnit: raw.pass_mark_unit ?? 'correct',
    passedAt: raw.passed_at ?? null,
    retryBlock: raw.retry_block === 'acknowledge' || raw.retry_block === 'retest' || raw.retry_block === 'lessons' ? raw.retry_block : null,
    retestOn: raw.retest_on ?? null,
  };
}

function asGates(raw: { id?: string; key?: string; label?: string; status?: string }[] | undefined): AcademyGateCard[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((gate) => {
    if (!gate.id || !gate.label) return [];
    return [{ id: gate.id, key: gate.key ?? '', label: gate.label, status: gate.status === 'satisfied' ? 'satisfied' as const : 'pending' as const }];
  });
}

function asState(value: string | undefined): AcademyState | null {
  return ACADEMY_STATES.find((state) => state === value) ?? null;
}

function asDisplay(value: string | undefined): AcademyModuleDisplay {
  return DISPLAYS.find((display) => display === value) ?? 'locked';
}

export function parseAcademyShell(raw: RawAcademyShell | null): AcademyShell | null {
  const state = asState(raw?.state);
  if (!raw || !state) return null;
  const modules: AcademyModule[] = Array.isArray(raw.modules)
    ? raw.modules.flatMap((module) => {
        if (!module.id || !module.title || typeof module.order !== 'number') return [];
        return [
          {
            id: module.id,
            order: module.order,
            title: module.title,
            description: module.description ?? '',
            required: Boolean(module.required),
            gateType: module.gate_type ?? 'none',
            gateDetail: module.gate_detail ?? null,
            display: asDisplay(module.display),
            openable: Boolean(module.openable),
            quiz: asQuiz(module.quiz),
            gates: asGates(module.gates),
          },
        ];
      })
    : [];

  return {
    state,
    program:
      raw.program?.id && raw.program.name
        ? {
            id: raw.program.id,
            name: raw.program.name,
            type: raw.program.type ?? '',
            version: raw.program.version ?? 1,
            status: raw.program.status ?? 'draft',
          }
        : null,
    enrollment: raw.enrollment?.id
      ? {
          id: raw.enrollment.id,
          status: raw.enrollment.status ?? '',
          track: raw.enrollment.track ?? '',
          startDate: raw.enrollment.start_date ?? null,
          targetDate: raw.enrollment.target_date ?? null,
        }
      : null,
    certification:
      raw.certification && typeof raw.certification.level === 'number' && raw.certification.label
        ? {
            level: raw.certification.level,
            label: raw.certification.label,
            vertical: raw.certification.vertical ?? null,
            grantedAt: raw.certification.granted_at ?? null,
            recertifyOn: raw.certification.recertify_on ?? null,
          }
        : null,
    progress: {
      completed: raw.progress?.completed ?? 0,
      total: raw.progress?.total ?? 0,
      percent: raw.progress?.percent ?? 0,
      unit: raw.progress?.unit === 'lessons' ? 'lessons' : 'modules',
    },
    currentModule:
      raw.current_module?.id && raw.current_module.title
        ? { id: raw.current_module.id, order: raw.current_module.order ?? 0, title: raw.current_module.title }
        : null,
    nextAction: raw.next_action?.title
      ? { title: raw.next_action.title, detail: raw.next_action.detail ?? '', href: raw.next_action.href ?? null }
      : null,
    banner: raw.banner ?? null,
    modules,
    hold:
      raw.hold?.manager_name && raw.hold.opened_at
        ? {
            managerName: raw.hold.manager_name,
            openedAt: raw.hold.opened_at,
            reviewStartedAt: raw.hold.review_started_at ?? null,
            status: raw.hold.status ?? 'open',
          }
        : null,
    remediation:
      raw.remediation?.hold_id && (raw.remediation.outcome === 'reset' || raw.remediation.outcome === 'extend')
        ? {
            holdId: raw.remediation.hold_id,
            outcome: raw.remediation.outcome,
            plan: raw.remediation.plan ?? '',
            attemptsGranted: raw.remediation.attempts_granted ?? 0,
            retestOn: raw.remediation.retest_on ?? null,
            acknowledgedAt: raw.remediation.acknowledged_at ?? null,
            lessons: Array.isArray(raw.remediation.lessons)
              ? raw.remediation.lessons.flatMap((lesson) =>
                  lesson.id && lesson.title
                    ? [{ id: lesson.id, title: lesson.title, code: lesson.code ?? '', moduleId: lesson.module_id ?? '', reopened: Boolean(lesson.reopened) }]
                    : [],
                )
              : [],
            modules: Array.isArray(raw.remediation.modules)
              ? raw.remediation.modules.flatMap((module) =>
                  module.id && module.title
                    ? [{ id: module.id, order: module.order ?? 0, title: module.title, reopened: Boolean(module.reopened) }]
                    : [],
                )
              : [],
          }
        : null,
  };
}
