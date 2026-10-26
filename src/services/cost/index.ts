import { apiRequest } from '../../request/apiClient';
import type { Page } from '../../request/errors';
import { toDecimalString } from './decimal';
import type { Band, NewPrice, PendingBatch, PriceBatch, UsageModel } from './types';

export {
  addDecimals,
  compareDecimals,
  formatAmount,
  isValidPrice,
  roundDecimal,
  sumDecimals,
  toDecimalString,
} from './decimal';
export { loadAllPages } from './loadAll';
export * from './types';
export { type BandBounds, type BandsVerdict, validateBands } from './validateBands';

type Raw = Record<string, unknown>;
const asRecord = (value: unknown): Raw =>
  typeof value === 'object' && value !== null ? (value as Raw) : {};
const text = (value: unknown): string =>
  typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value);
const textOrNull = (value: unknown): string | null => (typeof value === 'string' ? value : null);

const normalizeBand = (value: unknown): Band => {
  const raw = asRecord(value);
  return {
    inputMinTokens: Number(raw.inputMinTokens),
    inputMaxTokens:
      raw.inputMaxTokens === null || raw.inputMaxTokens === undefined
        ? null
        : Number(raw.inputMaxTokens),
    inputPrice: toDecimalString(raw.inputPrice),
    cachedInputPrice: toDecimalString(raw.cachedInputPrice),
    outputPrice: toDecimalString(raw.outputPrice),
  };
};

/**
 * A batch as the pages use it. Every price is decimal text without an exponent (a price that came as
 * a JSON number is written out in full; one that is not a number is null), so no page ever holds a
 * price as a float.
 */
export function normalizeBatch(value: unknown): PriceBatch {
  const raw = asRecord(value);
  return {
    batchId: text(raw.batchId),
    resourceType: text(raw.resourceType),
    provider: text(raw.provider),
    model: text(raw.model),
    unit: text(raw.unit),
    effectiveFrom: text(raw.effectiveFrom),
    currency: text(raw.currency),
    status: text(raw.status),
    source: text(raw.source),
    confirmedBy: textOrNull(raw.confirmedBy),
    confirmedByUsername: textOrNull(raw.confirmedByUsername),
    confirmedAt: textOrNull(raw.confirmedAt),
    reviewedBy: textOrNull(raw.reviewedBy),
    reviewedByUsername: textOrNull(raw.reviewedByUsername),
    reviewedAt: textOrNull(raw.reviewedAt),
    reviewNote: textOrNull(raw.reviewNote),
    createdAt: text(raw.createdAt),
    bands: Array.isArray(raw.bands) ? raw.bands.map(normalizeBand) : null,
    unitPrice: toDecimalString(raw.unitPrice),
  };
}

const normalizePending = (value: unknown): PendingBatch => ({
  ...normalizeBatch(value),
  active: asRecord(value).active ? normalizeBatch(asRecord(value).active) : null,
});

export type PriceQuery = {
  resourceType?: string;
  provider?: string;
  model?: string;
  unit?: string;
  status?: string;
  page: number;
  pageSize: number;
};

/** `GET /usage/prices` (`COST:VIEW`): one item per batch, by model and then newest effective date first. */
export async function listPrices(query: PriceQuery): Promise<Page<PriceBatch>> {
  const page = await apiRequest<Page<unknown>>({
    method: 'GET',
    url: '/usage/prices',
    params: { ...query },
  });
  return { items: page.items.map(normalizeBatch), total: page.total };
}

/** `GET /usage/price-batches/pending` (`COST:VIEW`): the batches waiting for review, each with the batch in force today. */
export async function listPendingBatches(): Promise<{ items: PendingBatch[] }> {
  const answer = await apiRequest<{ items: unknown[] }>({
    method: 'GET',
    url: '/usage/price-batches/pending',
  });
  return { items: answer.items.map(normalizePending) };
}

/** `GET /usage/models` (`COST:VIEW`). */
export async function listUsageModels(query: {
  page: number;
  pageSize: number;
}): Promise<Page<UsageModel>> {
  return apiRequest<Page<UsageModel>>({
    method: 'GET',
    url: '/usage/models',
    params: { ...query },
  });
}

/** `POST /usage/prices` (`COST:PRICE`, audited): a new batch that is in force at once. Prices go as strings. */
export async function createPrice(input: NewPrice): Promise<void> {
  await apiRequest<unknown>({ method: 'POST', url: '/usage/prices', body: input });
}

const batchPath = (batchId: string, action: string) =>
  `/usage/price-batches/${encodeURIComponent(batchId)}/${action}`;

/** `POST /usage/price-batches/{id}/confirm` (`COST:PRICE`): the batch becomes `ACTIVE`, with the checked date and currency. */
export async function confirmBatch(
  batchId: string,
  body: { effectiveFrom?: string; currency?: string },
): Promise<void> {
  await apiRequest<unknown>({ method: 'POST', url: batchPath(batchId, 'confirm'), body });
}

/** `POST /usage/price-batches/{id}/reject` (`COST:PRICE`): the note is required. */
export async function rejectBatch(batchId: string, note: string): Promise<void> {
  await apiRequest<unknown>({ method: 'POST', url: batchPath(batchId, 'reject'), body: { note } });
}

/** `POST /usage/price-batches/{id}/retire` (`COST:PRICE`): withdraws an `ACTIVE` batch; the note is required. */
export async function retireBatch(batchId: string, note: string): Promise<void> {
  await apiRequest<unknown>({ method: 'POST', url: batchPath(batchId, 'retire'), body: { note } });
}

/** `PUT /usage/models/{id}` (`COST:PRICE`): the synchronisation adapter (LLM only; `null` = by hand) and the model name it reads. */
export async function updateUsageModel(
  id: string,
  body: { syncAdapter: string | null; syncModelId: string },
): Promise<void> {
  await apiRequest<unknown>({
    method: 'PUT',
    url: `/usage/models/${encodeURIComponent(id)}`,
    body,
  });
}
