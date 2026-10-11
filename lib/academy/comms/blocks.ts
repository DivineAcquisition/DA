import type { AcademyCommsConfig } from './config';
import { fillMerge, type MergeFields } from './fields';

export type FooterKind = 'standard' | 'client' | 'internal';

export function standardFooter(config: AcademyCommsConfig): string {
  return [
    config.companyName,
    config.companyAddress,
    `Questions? Reply to this email or write to ${config.supportEmail}.`,
    'You are receiving this because you applied to or are enrolled in the DA Operator Academy.',
  ].join('\n');
}

export function clientFooter(config: AcademyCommsConfig, fields: MergeFields): { text: string; missing: string[] } {
  const filled = fillMerge(
    [
      config.companyName,
      config.companyAddress,
      'You are receiving this because Divine Acquisition provides services to [Client]. Reply to this email with any questions.',
    ].join('\n'),
    fields,
  );
  return filled;
}

export function internalFooter(config: AcademyCommsConfig): string {
  return [
    'Internal. Do not forward. Sent by the DA Academy notification system.',
    config.companyName,
    config.companyAddress,
  ].join('\n');
}

export function personalSignature(senderName: string): string {
  return [senderName, 'Divine Acquisition', 'Devotion. Value. Exclusivity.'].join('\n');
}

export function automatedSignature(): string {
  return ['Divine Acquisition', 'DA Operator Academy'].join('\n');
}

export function footerText(kind: FooterKind, config: AcademyCommsConfig, fields: MergeFields): { text: string; missing: string[] } {
  if (kind === 'client') return clientFooter(config, fields);
  if (kind === 'internal') return { text: internalFooter(config), missing: [] };
  return { text: standardFooter(config), missing: [] };
}
