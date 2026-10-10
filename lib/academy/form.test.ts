import { describe, expect, it } from 'vitest';
import { formId } from './form';

describe('formId', () => {
  it('treats a missing field as no id so a new lesson can be inserted', () => {
    expect(formId(null)).toBeNull();
    expect(formId('')).toBeNull();
    expect(formId('null')).toBeNull();
    expect(formId('  NULL  ')).toBeNull();
  });

  it('keeps a real id', () => {
    expect(formId('6b9d3a70-0000-4000-8000-000000000001')).toBe('6b9d3a70-0000-4000-8000-000000000001');
  });
});
