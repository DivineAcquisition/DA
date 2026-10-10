/** Optional ids from a form. A missing field is null, not the string "null". */

export function formId(value: FormDataEntryValue | null): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === 'null' || trimmed === 'undefined') return null;
  return trimmed;
}
