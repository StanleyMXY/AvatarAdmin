import { apiRequest } from '../../request/apiClient';
import { plainText } from '../../utils/plainText';
import type { Distribution, Platform } from '../appVersions/types';

// The channel packages (contract 24.7), for the page of the same name and for the version page.
// `GET /channels` already has a reader in the statistics services (`src/services/channels`); this
// one also reads what the page needs to show and change, with the column name the contract gives
// (`code`) and, as that reader does, `channelCode`.

export type ChannelPackage = {
  code: string;
  name: string;
  /** `ANDROID` or `IOS`; anything else the backend might send is kept as it is, and `''` when there is none. */
  platform: Platform | string;
  distribution: Distribution | string;
  packageName: string | null;
  enabled: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

const enc = encodeURIComponent;

const orNull = (value: unknown): string | null => {
  const text = plainText(value);
  return text === '' ? null : text;
};

function toPackage(row: unknown): ChannelPackage | null {
  if (typeof row !== 'object' || row === null || Array.isArray(row)) return null;
  const r = row as Record<string, unknown>;
  const code = typeof r.code === 'string' && r.code !== '' ? r.code : r.channelCode;
  if (typeof code !== 'string' || code === '') return null;
  return {
    code,
    name: plainText(r.name),
    platform: plainText(r.platform),
    distribution: plainText(r.distribution),
    packageName: orNull(r.packageName),
    enabled: r.enabled === true,
    createdAt: orNull(r.createdAt),
    updatedAt: orNull(r.updatedAt),
  };
}

/** `GET /channels`: any signed-in administrator. Rows without a code are dropped. */
export async function listChannelPackages(): Promise<ChannelPackage[]> {
  const data = await apiRequest<unknown>({ method: 'GET', url: '/channels' });
  const list = Array.isArray(data) ? data : (data as { items?: unknown } | null)?.items;
  if (!Array.isArray(list)) return [];
  return list.map(toPackage).filter((c): c is ChannelPackage => c !== null);
}

export type CreateChannelBody = {
  code: string;
  name: string;
  platform: Platform;
  distribution: Distribution;
  packageName: string | null;
};

/** The code, the platform and the distribution cannot be changed afterwards. */
export const createChannelPackage = (body: CreateChannelBody): Promise<unknown> =>
  apiRequest({ method: 'POST', url: '/channels', body });

export type UpdateChannelBody = { name: string; packageName: string | null; enabled: boolean };

/** Only these three can be changed. There is no delete: a channel is switched off. */
export const updateChannelPackage = (code: string, body: UpdateChannelBody): Promise<unknown> =>
  apiRequest({ method: 'PUT', url: `/channels/${enc(code)}`, body });
