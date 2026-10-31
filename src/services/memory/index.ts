import { apiRequest } from '../../request/apiClient';

/** An embedding model that an account without any assignment uses (contract 16.3). */
export const DEFAULT_EMBEDDING_MODEL = 'bge-m3';

/** The rule for tier and model names (contract 16 intro): they go into the URL path. */
export const MEMORY_NAME_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export type TierSettings = {
  topK: number;
  recencyChannelEnabled: boolean;
  recencyChannelCount: number;
  consolidationEnabled: boolean;
  consolidationThreshold: number;
};

export type MemoryTier = { tierName: string } & TierSettings;

export type EmbeddingModel = { modelName: string; teiBaseUrl: string; dimensions: number };

export type EmbeddingAssignment = {
  modelName: string;
  /** Administrator ID. */
  assignedBy: string;
  /** null when the administrator has been deleted. */
  assignedByUsername: string | null;
  assignedAt: string;
};

export type AccountMemory = {
  tier: {
    tierName: string | null;
    syncStatus: 'PENDING' | 'SYNCED' | 'FAILED' | string;
    assignedAt: string | null;
    lastError: string | null;
  };
  /** The newest 200 assignments at most, newest first. */
  embeddingAssignments: EmbeddingAssignment[];
  /** True when the account has more assignments than are in the list. Left out by a backend before this field. */
  truncated?: boolean;
  /** All the assignments of the account, those left out of the list included. */
  totalCount?: number;
};

const path = (name: string) => encodeURIComponent(name);

/** `GET /memory/tiers` (`MEMORY:VIEW`). */
export const listTiers = (): Promise<{ items: MemoryTier[] }> =>
  apiRequest<{ items: MemoryTier[] }>({ method: 'GET', url: '/memory/tiers' });

/** `GET /memory/tiers/{name}` (`MEMORY:VIEW`). */
export const getTier = (name: string): Promise<MemoryTier> =>
  apiRequest<MemoryTier>({ method: 'GET', url: `/memory/tiers/${path(name)}` });

/**
 * `PUT /memory/tiers/{name}` (`MEMORY:TIER_CONFIG`). Settings left out keep their value. It takes
 * effect for every account on the tier at once, and a name that is not in the list creates a tier
 * (there is no delete).
 */
export const saveTier = async (name: string, settings: Partial<TierSettings>): Promise<void> => {
  await apiRequest<unknown>({ method: 'PUT', url: `/memory/tiers/${path(name)}`, body: settings });
};

/** `GET /memory/embedding-models` (`MEMORY:VIEW`). */
export const listEmbeddingModels = (): Promise<{ items: EmbeddingModel[] }> =>
  apiRequest<{ items: EmbeddingModel[] }>({ method: 'GET', url: '/memory/embedding-models' });

/** `PUT /memory/embedding-models/{name}` (`MEMORY:MODEL_REGISTER`). */
export const registerEmbeddingModel = async (
  name: string,
  body: { teiBaseUrl: string; dimensions: number },
): Promise<void> => {
  await apiRequest<unknown>({ method: 'PUT', url: `/memory/embedding-models/${path(name)}`, body });
};

/** `GET /accounts/{id}/memory` (`MEMORY:VIEW`): the tier now and the history of model assignments. */
export const getAccountMemory = (accountId: string): Promise<AccountMemory> =>
  apiRequest<AccountMemory>({ method: 'GET', url: `/accounts/${path(accountId)}/memory` });

/** `PUT /accounts/{id}/memory/embedding-model` (`MEMORY:MODEL_ASSIGN`). */
export const assignEmbeddingModel = async (accountId: string, modelName: string): Promise<void> => {
  await apiRequest<unknown>({
    method: 'PUT',
    url: `/accounts/${path(accountId)}/memory/embedding-model`,
    body: { modelName },
  });
};
