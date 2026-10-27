import { apiRequest } from '../../request/apiClient';
import type {
  AccountAvatars,
  ActionCreate,
  ActionFields,
  ActionItem,
  CosmeticCreate,
  CosmeticFields,
  CosmeticItem,
  CosmeticQuery,
  Declaration,
  DefaultAvatar,
  DefaultAvatarCreate,
  GenerationTask,
  GenerationTaskType,
  Page,
  RendererModel,
  RendererModelCreate,
} from './types';

export * from './types';

const enc = encodeURIComponent;

/**
 * Reads a list answer. The contract does not say for every catalog whether the list is paged
 * (docs/contract-requests/2026-10-26-admin-frontend-cosmetics-complaints.md): an answer with a
 * `total` is the page asked for; an answer without one holds every row, and the page is cut here.
 */
function readPage<T>(data: unknown, page: number, pageSize: number): Page<T> {
  const list = Array.isArray(data) ? data : (data as { items?: unknown } | null)?.items;
  const items = Array.isArray(list) ? (list as T[]) : [];
  const total = (data as { total?: unknown } | null)?.total;
  if (typeof total === 'number' && Number.isFinite(total)) return { items, total };
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length };
}

async function listPage<T>(
  url: string,
  params: { page: number; pageSize: number } & Record<string, unknown>,
): Promise<Page<T>> {
  const data = await apiRequest<unknown>({ method: 'GET', url, params });
  return readPage<T>(data, params.page, params.pageSize);
}

// ---- cosmetics (COSMETIC:MANAGE; GET also COSMETIC:GRANT) ----

export const listCosmetics = (params: CosmeticQuery): Promise<Page<CosmeticItem>> =>
  listPage('/cosmetics', params);

export const createCosmetic = (body: CosmeticCreate): Promise<CosmeticItem> =>
  apiRequest({ method: 'POST', url: '/cosmetics', body });

/** `key` and `kind` are fixed once the item exists, so they are not part of the body. */
export const updateCosmetic = (id: string, body: CosmeticFields): Promise<CosmeticItem> =>
  apiRequest({ method: 'PUT', url: `/cosmetics/${enc(id)}`, body });

export const setCosmeticEnabled = (id: string, enabled: boolean): Promise<CosmeticItem> =>
  apiRequest({ method: 'PUT', url: `/cosmetics/${enc(id)}/enabled`, body: { enabled } });

// ---- actions (ACTION:MANAGE) ----

export const listActions = (params: {
  page: number;
  pageSize: number;
}): Promise<Page<ActionItem>> => listPage('/actions', params);

export const createAction = (body: ActionCreate): Promise<ActionItem> =>
  apiRequest({ method: 'POST', url: '/actions', body });

export const updateAction = (id: string, body: ActionFields): Promise<ActionItem> =>
  apiRequest({ method: 'PUT', url: `/actions/${enc(id)}`, body });

export const setActionEnabled = (id: string, enabled: boolean): Promise<ActionItem> =>
  apiRequest({ method: 'PUT', url: `/actions/${enc(id)}/enabled`, body: { enabled } });

/**
 * `POST /actions/{id}/backfill`: queues the clips of this action for the looks that lack one (this
 * costs generation fees). 404 if the action is gone, 409 INVALID_STATE if it is disabled.
 */
export const backfillAction = (id: string): Promise<{ scheduled: number }> =>
  apiRequest({ method: 'POST', url: `/actions/${enc(id)}/backfill` });

// ---- declarations (DECLARATION:MANAGE) ----

export const listDeclarations = (params: {
  page: number;
  pageSize: number;
}): Promise<Page<Declaration>> => listPage('/declarations', params);

export const createDeclaration = (body: {
  version: string;
  texts: Record<string, string>;
}): Promise<Declaration> => apiRequest({ method: 'POST', url: '/declarations', body });

export const activateDeclaration = (version: string): Promise<Declaration> =>
  apiRequest({ method: 'PUT', url: `/declarations/${enc(version)}/activate` });

// ---- renderer models (RENDERER:MANAGE) ----

export const listRendererModels = (params: {
  page: number;
  pageSize: number;
}): Promise<Page<RendererModel>> => listPage('/renderer-models', params);

/** `sha256` and `sizeBytes` come from the upload record on the server and are not sent. */
export const createRendererModel = (body: RendererModelCreate): Promise<RendererModel> =>
  apiRequest({ method: 'POST', url: '/renderer-models', body });

export const setRendererModelEnabled = (id: string, enabled: boolean): Promise<RendererModel> =>
  apiRequest({ method: 'PUT', url: `/renderer-models/${enc(id)}/enabled`, body: { enabled } });

// ---- generation tasks (GENERATION:VIEW) ----

/** Failed tasks only (`status=FAILED` is always sent); the only other filter is the type. */
export const listGenerationTasks = (params: {
  page: number;
  pageSize: number;
  type?: GenerationTaskType;
}): Promise<Page<GenerationTask>> =>
  listPage('/generation-tasks', {
    page: params.page,
    pageSize: params.pageSize,
    status: 'FAILED',
    type: params.type,
  });

// ---- default avatars (DEFAULT_AVATAR:MANAGE) ----

/** Not paged: newest first. */
export const listDefaultAvatars = (): Promise<{ items: DefaultAvatar[] }> =>
  apiRequest({ method: 'GET', url: '/default-avatars' });

export const createDefaultAvatar = (body: DefaultAvatarCreate): Promise<DefaultAvatar> =>
  apiRequest({ method: 'POST', url: '/default-avatars', body });

/** Only the name changes. */
export const renameDefaultAvatar = (id: string, name: string): Promise<DefaultAvatar> =>
  apiRequest({ method: 'PUT', url: `/default-avatars/${enc(id)}`, body: { name } });

export const generateDefaultAvatar = (id: string): Promise<DefaultAvatar> =>
  apiRequest({ method: 'POST', url: `/default-avatars/${enc(id)}/generate` });

export const activateDefaultAvatar = (id: string): Promise<DefaultAvatar> =>
  apiRequest({ method: 'POST', url: `/default-avatars/${enc(id)}/activate` });

export const deleteDefaultAvatar = (id: string): Promise<unknown> =>
  apiRequest({ method: 'DELETE', url: `/default-avatars/${enc(id)}` });

// ---- an account's avatars and cosmetics (used by the user detail page) ----

/**
 * `GET /accounts/{id}/avatars` (`USER:VIEW`): the account's avatars with their looks and the cosmetics
 * it owns, with the source of each. The preview addresses show the user's face and are signed for a
 * short time; the call is written to the audit log. Read again on every visit.
 */
export const getAccountAvatars = (id: string): Promise<AccountAvatars> =>
  apiRequest({ method: 'GET', url: `/accounts/${enc(id)}/avatars` });

/** `POST /accounts/{id}/cosmetics` (`COSMETIC:GRANT`): gives the account a cosmetic for good (source ADMIN_GRANT). */
export const grantCosmetic = (
  id: string,
  body: { itemId: string; reason: string },
): Promise<unknown> => apiRequest({ method: 'POST', url: `/accounts/${enc(id)}/cosmetics`, body });
