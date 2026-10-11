import { createHmac, timingSafeEqual } from 'node:crypto';

export function secretsMatch(provided: string, expected: string): boolean {
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length === 0 || right.length === 0 || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function bodySignature(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

export function webhookAuthorized(input: {
  secretHeader: string;
  signatureHeader: string;
  body: string;
  secret: string;
}): boolean {
  if (!input.secret) return false;
  if (input.secretHeader && secretsMatch(input.secretHeader, input.secret)) return true;
  if (!input.signatureHeader) return false;
  return secretsMatch(input.signatureHeader.trim().toLowerCase(), bodySignature(input.body, input.secret));
}
