import {
  ACADEMY_STATES,
  type AcademyModule,
  type AcademyModuleDisplay,
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
  progress?: { completed?: number; total?: number; percent?: number };
  current_module?: { id?: string; order?: number; title?: string } | null;
  next_action?: { title?: string; detail?: string; href?: string | null } | null;
  banner?: string | null;
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
  }[];
};

const DISPLAYS: AcademyModuleDisplay[] = ['locked', 'available', 'in_progress', 'complete', 'unpublished'];

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
  };
}
