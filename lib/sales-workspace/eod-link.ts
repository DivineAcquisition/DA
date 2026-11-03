/** Private end-of-day links. The token is the credential. */
export const EOD_TOKEN = /^[0-9a-f]{48}$/i;

export function eodToken(value: string | null | undefined): string | null {
  const token = value?.trim().toLowerCase() ?? '';
  return EOD_TOKEN.test(token) ? token : null;
}

export function eodPublicPath(token: string): string {
  return `/eod/${token}`;
}
