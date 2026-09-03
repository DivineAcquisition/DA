import { describe, expect, it } from 'vitest';
import { pickAirtableApiKey } from './airtable-key';

describe('pickAirtableApiKey', () => {
  it('uses the backend settings token when present', () => {
    expect(pickAirtableApiKey('pat.settings', 'pat.env')).toBe('pat.settings');
  });

  it('falls back to a local env token when settings is empty', () => {
    expect(pickAirtableApiKey('  ', 'pat.env')).toBe('pat.env');
  });

  it('is empty when neither source has a token', () => {
    expect(pickAirtableApiKey('', '')).toBe('');
  });
});
