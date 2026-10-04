import { describe, expect, it } from 'vitest';
import { academyPathKind, formatAcademyDate, moduleStatusLabel } from './paths';

describe('academy paths', () => {
  it('keeps the trainee screens and treats every other path as missing', () => {
    expect(academyPathKind('/academy')).toBe('home');
    expect(academyPathKind('/academy/')).toBe('home');
    expect(academyPathKind('/academy/modules')).toBe('modules');
    expect(academyPathKind('/academy/modules/6f0b4c2e-1a2b-4c3d-8e9f-0a1b2c3d4e5f')).toBe('module');
    expect(academyPathKind('/academy/modules/6f0b4c2e-1a2b-4c3d-8e9f-0a1b2c3d4e5f/lessons/m1')).toBe('lesson');
    expect(academyPathKind('/academy/modules/6f0b4c2e-1a2b-4c3d-8e9f-0a1b2c3d4e5f/quiz')).toBe('quiz');
    expect(academyPathKind('/academy/modules/6f0b4c2e-1a2b-4c3d-8e9f-0a1b2c3d4e5f/simulations/abc')).toBe('simulation');
    expect(academyPathKind('/academy/modules/6f0b4c2e-1a2b-4c3d-8e9f-0a1b2c3d4e5f/drill')).toBe('drill');
    expect(academyPathKind('/academy/modules/6f0b4c2e-1a2b-4c3d-8e9f-0a1b2c3d4e5f/reflection')).toBe('reflection');
    expect(academyPathKind('/academy/modules/6f0b4c2e-1a2b-4c3d-8e9f-0a1b2c3d4e5f/practical')).toBe('practical');
    expect(academyPathKind('/academy/not-found')).toBe('missing');
    expect(academyPathKind('/vistrial/ops')).toBe('missing');
    expect(academyPathKind('/workspace/agreements')).toBe('missing');
    expect(academyPathKind('/academy/modules/one/extra')).toBe('missing');
  });

  it('names module states the way the shell shows them', () => {
    expect(moduleStatusLabel('unpublished')).toBe('Not yet published');
    expect(moduleStatusLabel('locked')).toBe('Locked');
    expect(moduleStatusLabel('in_progress')).toBe('In progress');
    expect(moduleStatusLabel('complete')).toBe('Complete');
    expect(moduleStatusLabel('available')).toBe('Available');
    expect(moduleStatusLabel('lessons_complete')).toBe('Lessons complete, quiz not yet available');
    expect(moduleStatusLabel('quiz_passed_pending')).toBe('Quiz passed, additional requirement pending');
  });

  it('formats a calendar date without moving the day', () => {
    expect(formatAcademyDate('2026-10-04')).toBe('Oct 4, 2026');
    expect(formatAcademyDate('2026-10-04T23:30:00Z')).toBe('Oct 4, 2026');
    expect(formatAcademyDate(null)).toBeNull();
  });
});
