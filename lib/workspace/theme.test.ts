import { describe, expect, it } from 'vitest';
import { workspaceThemeActive } from './theme';

describe('workspace theme', () => {
  it('applies on signed-in workspace paths only', () => {
    expect(workspaceThemeActive('/workspace/operator', true)).toBe(true);
    expect(workspaceThemeActive('/workspace/overview', true)).toBe(true);
    expect(workspaceThemeActive('/workspace', true)).toBe(true);
  });

  it('leaves the sign-in desk and the public site dark', () => {
    expect(workspaceThemeActive('/workspace/operator', false)).toBe(false);
    expect(workspaceThemeActive('/workspace/login', true)).toBe(false);
    expect(workspaceThemeActive('/workspace/forgot-password', true)).toBe(false);
    expect(workspaceThemeActive('/workspace/reset-password', true)).toBe(false);
    expect(workspaceThemeActive('/workspace/auth/callback', true)).toBe(false);
    expect(workspaceThemeActive('/', true)).toBe(false);
    expect(workspaceThemeActive('/hiring', true)).toBe(false);
  });
});
