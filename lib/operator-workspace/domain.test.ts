import { describe, expect, it } from 'vitest';
import { cleanOrigin, hostRole, normalizeDomain, servingHosts } from './domain';

describe('operator workspace domain', () => {
  it('keeps a host and drops a path', () => {
    expect(cleanOrigin(' HTTPS://Ops.Example.test/ ')).toBe('https://ops.example.test');
    expect(cleanOrigin('https://ops.example.test/workspace')).toBeNull();
    expect(cleanOrigin('ops.example.test')).toBe('https://ops.example.test');
    expect(cleanOrigin('https://ops.example.test/operator')).toBeNull();
    expect(cleanOrigin('')).toBeNull();
  });

  it('lets a second host serve, and sends a retired host to the canonical one', () => {
    const domain = normalizeDomain({
      origin: 'https://new.example.test',
      alsoActive: ['https://old.example.test', 'https://new.example.test'],
      retired: ['https://old.example.test', 'https://gone.example.test'],
    });
    expect(domain.alsoActive).toEqual([]);
    expect(domain.retired).toEqual(['https://old.example.test', 'https://gone.example.test']);
    expect(hostRole('new.example.test', domain)).toBe('canonical');
    expect(hostRole('old.example.test', domain)).toBe('retired');
    expect(hostRole('gone.example.test', domain)).toBe('retired');
    expect(servingHosts(domain, ['old.example.test', 'extra.example.test'])).toEqual([
      'new.example.test',
      'extra.example.test',
    ]);
  });

  it('treats an also-active host as the operator workspace', () => {
    const domain = normalizeDomain({
      origin: 'https://new.example.test',
      alsoActive: ['https://old.example.test/'],
      retired: [],
    });
    expect(hostRole('old.example.test', domain)).toBe('active');
    expect(servingHosts(domain)).toEqual(['new.example.test', 'old.example.test']);
  });
});
