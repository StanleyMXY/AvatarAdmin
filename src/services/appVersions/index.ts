import { apiRequest } from '../../request/apiClient';
import type { Page } from '../../request/errors';
import type {
  AppVersion,
  CreateVersionBody,
  UpdateVersionBody,
  VersionQuery,
  VersionStatus,
} from './types';

export * from './types';

const enc = encodeURIComponent;

const isRow = (value: unknown): value is AppVersion =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * `GET /app-versions` (APPVERSION:VIEW). The contract does not say whether the list is paged. A
 * page `{ items, total }` is kept as the backend made it; a bare list, a page without a total, or a
 * page longer than the page size asked for (the backend did not page) is one whole list, and the
 * requested page of it is cut here.
 */
export async function listAppVersions(query: VersionQuery): Promise<Page<AppVersion>> {
  const { page, pageSize, channelCode, platform, status } = query;
  const data = await apiRequest<unknown>({
    method: 'GET',
    url: '/app-versions',
    params: {
      ...(channelCode ? { channelCode } : {}),
      ...(platform ? { platform } : {}),
      ...(status ? { status } : {}),
      page,
      pageSize,
    },
  });
  const list = Array.isArray(data) ? data : (data as { items?: unknown } | null)?.items;
  if (!Array.isArray(list)) return { items: [], total: 0 };
  const items = list.filter(isRow);
  const total = Array.isArray(data) ? undefined : (data as { total?: unknown }).total;
  if (typeof total === 'number' && items.length <= pageSize) return { items, total };
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    total: typeof total === 'number' && total > items.length ? total : items.length,
  };
}

/**
 * The version that is active in a channel, or `null` when there is none. A failure is thrown: the
 * caller then says that the number is not known.
 */
export async function readActiveVersion(channelCode: string): Promise<AppVersion | null> {
  const answer = await listAppVersions({ channelCode, status: 'ACTIVE', page: 1, pageSize: 20 });
  return answer.items.find((v) => v.status === 'ACTIVE' && v.channelCode === channelCode) ?? null;
}

export const getAppVersion = (id: string): Promise<AppVersion> =>
  apiRequest({ method: 'GET', url: `/app-versions/${enc(id)}` });

export const createAppVersion = (body: CreateVersionBody): Promise<AppVersion> =>
  apiRequest({ method: 'POST', url: '/app-versions', body });

/** Drafts only: 409 INVALID_STATE (`data.status` is the current state) for any other. */
export const updateAppVersion = (id: string, body: UpdateVersionBody): Promise<AppVersion> =>
  apiRequest({ method: 'PUT', url: `/app-versions/${enc(id)}`, body });

/**
 * DRAFT to ACTIVE, or ACTIVE to ARCHIVED. A STORE channel's activation needs `confirmStoreLive`
 * (400 INVALID_REQUEST without it); a DIRECT channel's does not take it.
 */
export const setAppVersionStatus = (
  id: string,
  status: Exclude<VersionStatus, 'DRAFT'>,
  confirmStoreLive?: boolean,
): Promise<AppVersion> =>
  apiRequest({
    method: 'PUT',
    url: `/app-versions/${enc(id)}/status`,
    body: confirmStoreLive === undefined ? { status } : { status, confirmStoreLive },
  });

export const deleteAppVersion = (id: string): Promise<unknown> =>
  apiRequest({ method: 'DELETE', url: `/app-versions/${enc(id)}` });
