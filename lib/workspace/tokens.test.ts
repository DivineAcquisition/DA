import { describe, expect, it } from 'vitest';
import {
  applyVariables,
  createToken,
  resolveVariables,
  UNRESOLVED_GAP,
} from './tokens';

describe('workspace tokens', () => {
  it('creates cryptographically random tokens of at least 32 characters', () => {
    const a = createToken();
    const b = createToken();
    expect(a.length).toBeGreaterThanOrEqual(32);
    expect(b.length).toBeGreaterThanOrEqual(32);
    expect(a).not.toBe(b);
  });

  it('renders unresolved variables as a visible gap', () => {
    const resolved = resolveVariables(['recipient_name', 'business_name'], {
      recipient_name: 'Ada',
      business_name: '',
    });
    expect(resolved.recipient_name).toBe('Ada');
    expect(resolved.business_name).toBe(UNRESOLVED_GAP);
    expect(applyVariables('Hi {{recipient_name}} at {{business_name}}', resolved)).toBe(
      `Hi Ada at ${UNRESOLVED_GAP}`,
    );
  });

  it('never leaves raw placeholders for unknown variables', () => {
    expect(applyVariables('Hello {{missing}}', {})).toBe(`Hello ${UNRESOLVED_GAP}`);
  });
});
