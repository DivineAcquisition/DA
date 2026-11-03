import { describe, expect, it } from 'vitest';
import { eodPublicPath, eodToken } from './eod-link';

describe('eod links', () => {
  it('accepts a 48 character hex token and ignores case', () => {
    const token = 'A'.repeat(24) + 'b'.repeat(24);
    expect(eodToken(`  ${token}  `)).toBe(token.toLowerCase());
    expect(eodPublicPath(token.toLowerCase())).toBe(`/eod/${token.toLowerCase()}`);
  });

  it('rejects anything that is not the private link', () => {
    expect(eodToken('')).toBeNull();
    expect(eodToken('not-a-token')).toBeNull();
    expect(eodToken('a'.repeat(47))).toBeNull();
    expect(eodToken(`${'a'.repeat(48)}ff`)).toBeNull();
  });
});
