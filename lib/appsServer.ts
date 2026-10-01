import { headers } from 'next/headers';
import { appForHost, type AppKey } from './apps';

/** Which app this request is being served as, or null on localhost and previews. */
export async function currentApp(): Promise<AppKey | null> {
  const h = await headers();
  const host = h.get('x-vistrial-host') ?? h.get('host') ?? '';
  return appForHost(host);
}
