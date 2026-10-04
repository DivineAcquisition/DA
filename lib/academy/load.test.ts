import { describe, expect, it } from 'vitest';
import { parseAcademyShell } from './parse';

describe('academy shell parser', () => {
  it('keeps a trainee shell and drops a module row that has no id', () => {
    const shell = parseAcademyShell({
      state: 'active',
      program: { id: 'p1', name: 'DA Operator Academy', type: 'core', version: 1, status: 'draft' },
      enrollment: { id: 'e1', status: 'active', track: 'core', start_date: '2026-10-04', target_date: null },
      certification: null,
      progress: { completed: 0, total: 13, percent: 0 },
      current_module: { id: 'm0', order: 0, title: 'Access and Agreement' },
      next_action: { title: 'Not yet published', detail: 'Access and Agreement has no lessons yet.', href: null },
      banner: null,
      modules: [
        { id: 'm0', order: 0, title: 'Access and Agreement', description: 'Sign.', required: true, gate_type: 'agreement', gate_detail: 'Agreement signed', display: 'unpublished', openable: false },
        { order: 1, title: 'Missing id' },
      ],
    });
    expect(shell?.state).toBe('active');
    expect(shell?.modules).toHaveLength(1);
    expect(shell?.modules[0].display).toBe('unpublished');
    expect(shell?.nextAction?.href).toBeNull();
    expect(shell?.program?.name).toBe('DA Operator Academy');
  });

  it('refuses a payload with no known state', () => {
    expect(parseAcademyShell({ state: 'demo' })).toBeNull();
    expect(parseAcademyShell(null)).toBeNull();
  });
});
