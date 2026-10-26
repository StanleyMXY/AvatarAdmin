/** The resource types of contract 14.2, and the unit each is priced in. */
export const RESOURCE_TYPES = [
  'LLM',
  'IMAGE_EDIT',
  'IMAGE_TO_VIDEO',
  'MATTING',
  'DRIVING_PREP',
  'AGE_ESTIMATION',
  'CLOUD_RENDER',
] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export type PriceUnit = 'TOKENS_1M' | 'CALL' | 'SECOND' | 'MINUTE';

export const UNIT_OF: Record<ResourceType, PriceUnit> = {
  LLM: 'TOKENS_1M',
  IMAGE_EDIT: 'CALL',
  IMAGE_TO_VIDEO: 'SECOND',
  MATTING: 'CALL',
  DRIVING_PREP: 'CALL',
  AGE_ESTIMATION: 'CALL',
  CLOUD_RENDER: 'MINUTE',
};

export const BATCH_STATUSES = [
  'PENDING_REVIEW',
  'ACTIVE',
  'REJECTED',
  'SUPERSEDED',
  'RETIRED',
] as const;
export type BatchStatus = (typeof BATCH_STATUSES)[number];

/** The only synchronisation adapter there is (contract 14.2); empty means "enter the prices by hand". */
export const SYNC_ADAPTERS = ['DASHSCOPE_INTL'] as const;

/**
 * One band of an LLM price: the input length it covers (both ends included, `null` upper bound = no
 * limit) and the three prices per million tokens as decimal text (`null` = not given or not a number).
 * A cached input price that is empty is charged at the input price.
 */
export type Band = {
  inputMinTokens: number;
  inputMaxTokens: number | null;
  inputPrice: string | null;
  cachedInputPrice: string | null;
  outputPrice: string | null;
};

/** A price batch (`GET /usage/prices`): the rows of one model on one effective date. LLM has `bands`, the others a `unitPrice`. */
export type PriceBatch = {
  batchId: string;
  resourceType: string;
  provider: string;
  model: string;
  unit: string;
  /** A UTC day, `YYYY-MM-DD`. */
  effectiveFrom: string;
  currency: string;
  status: BatchStatus | string;
  source: 'SYNC' | 'MANUAL' | string;
  confirmedBy: string | null;
  confirmedByUsername: string | null;
  confirmedAt: string | null;
  reviewedBy: string | null;
  reviewedByUsername: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  bands: Band[] | null;
  unitPrice: string | null;
};

/** A batch waiting for review, with the batch that is in force today for the same model (null when there is none). */
export type PendingBatch = PriceBatch & { active: PriceBatch | null };

export type UsageModel = {
  id: string;
  resourceType: string;
  provider: string;
  model: string;
  syncAdapter: string | null;
  syncModelId: string | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  hasActivePrice: boolean;
};

/** A band as it is sent: the prices are strings, never numbers. */
export type NewBand = {
  inputMinTokens: number;
  inputMaxTokens: number | null;
  inputPrice: string;
  cachedInputPrice: string | null;
  outputPrice: string;
};

export type NewPrice = {
  resourceType: string;
  provider: string;
  model: string;
  unit: string;
  effectiveFrom: string;
  currency: string;
} & ({ bands: NewBand[]; unitPrice?: undefined } | { unitPrice: string; bands?: undefined });
