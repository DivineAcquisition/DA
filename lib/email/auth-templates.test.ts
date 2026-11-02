import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { authEmailTemplates } from './auth-templates';
import { EMAIL_BRAND } from './layout';

describe('supabase auth emails', () => {
  const templates = authEmailTemplates();

  it('matches the branded files, not the Supabase default', () => {
    const dir = new URL('../../supabase/templates/', import.meta.url);
    const files = readdirSync(dir).filter((name) => name.endsWith('.html')).sort();
    expect(files).toEqual(templates.map((template) => template.file).sort());
    for (const template of templates) {
      const html = readFileSync(new URL(template.file, dir), 'utf8');
      expect(html, template.file).toBe(`${template.html}\n`);
      expect(html, template.file).toContain(EMAIL_BRAND.logoUrl);
      expect(html, template.file).toContain(EMAIL_BRAND.primary);
      expect(html, template.file).toContain('Plus Jakarta Sans');
      expect(html, template.file).toContain(EMAIL_BRAND.motto);
      expect(html, template.file).not.toMatch(/Georgia|Times New Roman/);
    }
  });

  it('keeps the fields Supabase fills in', () => {
    const html = Object.fromEntries(templates.map((template) => [template.file, template.html]));
    for (const file of ['confirmation.html', 'invite.html', 'magic_link.html', 'recovery.html', 'email_change.html']) {
      expect(html[file], file).toContain('{{ .ConfirmationURL }}');
    }
    expect(html['reauthentication.html']).toContain('{{ .Token }}');
    expect(html['email_change.html']).toContain('{{ .NewEmail }}');
    expect(html['email_changed_notification.html']).toContain('{{ .OldEmail }}');
    expect(html['phone_changed_notification.html']).toContain('{{ .OldPhone }}');
    expect(html['identity_linked_notification.html']).toContain('{{ .Provider }}');
    expect(html['mfa_factor_enrolled_notification.html']).toContain('{{ .FactorType }}');
  });
});
