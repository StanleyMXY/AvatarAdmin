import { apiRequest } from '../../request/apiClient';
import type { ClientConfigItem, ClientConfigValue } from './types';

export * from './types';

const enc = encodeURIComponent;

/** `GET /client-config` (CLIENTCONFIG:VIEW): every registered key, by key, not paged. */
export async function listClientConfig(): Promise<ClientConfigItem[]> {
  const data = await apiRequest<unknown>({ method: 'GET', url: '/client-config' });
  const items = (data as { items?: unknown } | null)?.items;
  return Array.isArray(items) ? (items as ClientConfigItem[]) : [];
}

/**
 * One key as the backend has it now. There is no read of a single key: this is `GET /client-config`
 * and the key picked from the answer; undefined when the answer does not have it.
 */
export async function readClientConfigKey(key: string): Promise<ClientConfigItem | undefined> {
  return (await listClientConfig()).find((item) => item?.key === key);
}

/**
 * `PUT /client-config/{key}` (CLIENTCONFIG:MANAGE): replaces the values of all languages of the
 * key at once; one language that does not pass refuses the lot (400 INVALID_REQUEST, `details`
 * name the language). A read-only key is refused with 400.
 */
export const saveClientConfig = (
  key: string,
  values: Record<string, ClientConfigValue>,
): Promise<unknown> =>
  apiRequest({ method: 'PUT', url: `/client-config/${enc(key)}`, body: { values } });

/** `POST /client-config/{key}/reset` (CLIENTCONFIG:MANAGE): deletes the values of all languages of the key. */
export const resetClientConfig = (key: string): Promise<unknown> =>
  apiRequest({ method: 'POST', url: `/client-config/${enc(key)}/reset` });
