import { apiRequest } from '../../request/apiClient';

export type ConfigItem = {
  key: string;
  /** The value now in force: the saved one, else the default; null when there is neither. */
  value: unknown;
  defaultValue: unknown;
  editPermission: string;
  /** null for a key that was never saved (it is on its default). */
  updatedAt: string | null;
  updatedBy: string | null;
  updatedByUsername: string | null;
};

export type ConfigWarning = { code: string; message: string; count?: number };

export type ConfigSaveResult = { key: string; value: unknown; warnings: ConfigWarning[] };

/** `GET /config`: only the keys the administrator may edit, by key name, not paged. */
export const listConfig = (): Promise<{ items: ConfigItem[] }> =>
  apiRequest<{ items: ConfigItem[] }>({ method: 'GET', url: '/config' });

/** `PUT /config/{key}` with `{ value }`: one key at a time. */
export const saveConfig = (key: string, value: unknown): Promise<ConfigSaveResult> =>
  apiRequest<ConfigSaveResult>({
    method: 'PUT',
    url: `/config/${encodeURIComponent(key)}`,
    body: { value },
  });

/** `DELETE /config/{key}`: back to the default value. */
export const resetConfig = (key: string): Promise<ConfigSaveResult> =>
  apiRequest<ConfigSaveResult>({ method: 'DELETE', url: `/config/${encodeURIComponent(key)}` });
