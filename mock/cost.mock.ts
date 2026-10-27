// The cost endpoints of the mock backend (contract 14.2 and 17.4, the cost row): the price batches,
// the pending batches with the batch in force, the model registration, and the writes (enter by
// hand, confirm, reject, retire). Reads need `COST:VIEW`, writes `COST:PRICE`. The report itself
// (`GET /stats/usage-cost`) is in stats.mock.ts. The data is in _core/costData.ts.
import { countCodePoints } from '../src/utils/codePoints';
import { trimSpec } from '../src/utils/trimSpec';
import { guard } from './_core/auth';
import {
  activeToday,
  costState,
  hasActivePrice,
  type MockBand,
  type MockBatch,
  type MockUsageModel,
  modelKey,
  newBatchId,
} from './_core/costData';
import { bodyOf, invalidRequest, MockHttpError, type MockReq, ok } from './_core/http';
import { META_DEFAULTS } from './_core/meta';
import { paginate, pagingOf } from './_core/paginate';

const UNITS: Record<string, string> = {
  LLM: 'TOKENS_1M',
  IMAGE_EDIT: 'CALL',
  IMAGE_TO_VIDEO: 'SECOND',
  MATTING: 'CALL',
  DRIVING_PREP: 'CALL',
  AGE_ESTIMATION: 'CALL',
  CLOUD_RENDER: 'MINUTE',
};
const STATUSES = ['PENDING_REVIEW', 'ACTIVE', 'REJECTED', 'SUPERSEDED', 'RETIRED'];
const MAX_BANDS = 20;
const PRICE = /^\d+(\.\d{1,10})?$/;
const PRICE_MAX_UNITS = 10_000_000_000_000_000n; // 1000000 with ten decimals

type Detail = { ref: string; reason: string };

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

const day = (value: unknown): string | null => {
  const s = typeof value === 'string' ? value : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : s;
};

/** A price as the contract wants it: a string, digits only, up to ten decimals, at most 1000000. */
function priceOk(value: unknown): boolean {
  if (typeof value !== 'string' || !PRICE.test(value)) return false;
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole + fraction.padEnd(10, '0')) <= PRICE_MAX_UNITS;
}

const isBound = (n: unknown): n is number =>
  typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;

/** The band rules of 14.2: whole numbers, first from 0, next = previous + 1, only the last has no upper bound. */
function bandsProblem(bands: unknown): boolean {
  if (!Array.isArray(bands) || bands.length === 0 || bands.length > MAX_BANDS) return true;
  for (let i = 0; i < bands.length; i += 1) {
    const b = bands[i] as Partial<MockBand> | null;
    if (typeof b !== 'object' || b === null || !isBound(b.inputMinTokens)) return true;
    const last = i === bands.length - 1;
    if (last ? b.inputMaxTokens !== null : !isBound(b.inputMaxTokens)) return true;
    if (i === 0 && b.inputMinTokens !== 0) return true;
    if (i > 0) {
      const before = bands[i - 1] as MockBand;
      if (b.inputMinTokens !== (before.inputMaxTokens as number) + 1) return true;
    }
    if (!last && (b.inputMaxTokens as number) < b.inputMinTokens) return true;
  }
  return false;
}

const bandPricesProblems = (bands: unknown[]): Detail[] =>
  bands.flatMap((raw, i) => {
    const b = raw as Partial<MockBand>;
    const out: Detail[] = [];
    if (!priceOk(b.inputPrice)) out.push({ ref: `bands[${i}].inputPrice`, reason: 'OUT_OF_RANGE' });
    if (
      b.cachedInputPrice !== null &&
      b.cachedInputPrice !== undefined &&
      !priceOk(b.cachedInputPrice)
    ) {
      out.push({ ref: `bands[${i}].cachedInputPrice`, reason: 'OUT_OF_RANGE' });
    }
    if (!priceOk(b.outputPrice))
      out.push({ ref: `bands[${i}].outputPrice`, reason: 'OUT_OF_RANGE' });
    return out;
  });

const allowedCurrency = (value: unknown): boolean =>
  typeof value === 'string' &&
  (META_DEFAULTS.allowedCurrencies as readonly string[]).includes(value);

const note = (req: MockReq): string => {
  const value = trimSpec(text(bodyOf(req).note));
  const length = countCodePoints(value);
  if (length < 1 || length > 500)
    throw invalidRequest('note is not valid', [
      { ref: 'note', reason: length === 0 ? 'EMPTY_NOT_ALLOWED' : 'TOO_LONG' },
    ]);
  return value;
};

const batchOf = (id: string): MockBatch => {
  const found = costState.batches.find((b) => b.batchId === id);
  if (!found) throw new MockHttpError(404, 'RESOURCE_NOT_FOUND', 'There is no such price batch');
  return found;
};

const requireStatus = (b: MockBatch, status: MockBatch['status']) => {
  if (b.status !== status) {
    throw new MockHttpError(409, 'INVALID_STATE', 'The batch is not in the state this needs', {
      status: b.status,
    });
  }
};

/** A batch that becomes ACTIVE replaces the ACTIVE one of the same model and effective date. */
const supersedeSameDay = (becoming: MockBatch) => {
  for (const other of costState.batches) {
    if (
      other !== becoming &&
      other.status === 'ACTIVE' &&
      modelKey(other) === modelKey(becoming) &&
      other.effectiveFrom === becoming.effectiveFrom
    ) {
      other.status = 'SUPERSEDED';
    }
  }
};

const byModelThenDate = (a: MockBatch, b: MockBatch): number => {
  const ka = modelKey(a);
  const kb = modelKey(b);
  if (ka !== kb) return ka < kb ? -1 : 1;
  return a.effectiveFrom < b.effectiveFrom ? 1 : a.effectiveFrom > b.effectiveFrom ? -1 : 0;
};

const viewOf = ({ ...rest }: MockBatch): MockBatch => structuredClone(rest);

export default {
  'GET /api/admin/usage/prices': guard('COST:VIEW', (req) => {
    const status = text(req.query.status);
    const resourceType = text(req.query.resourceType);
    const problems: Detail[] = [];
    if (status !== '' && !STATUSES.includes(status))
      problems.push({ ref: 'status', reason: 'OUT_OF_RANGE' });
    if (resourceType !== '' && !(resourceType in UNITS))
      problems.push({ ref: 'resourceType', reason: 'OUT_OF_RANGE' });
    if (problems.length > 0) throw invalidRequest('invalid filter', problems);
    const rows = costState.batches
      .filter((b) => status === '' || b.status === status)
      .filter((b) => resourceType === '' || b.resourceType === resourceType)
      .filter((b) => text(req.query.provider) === '' || b.provider === text(req.query.provider))
      .filter((b) => text(req.query.model) === '' || b.model === text(req.query.model))
      .filter((b) => text(req.query.unit) === '' || b.unit === text(req.query.unit))
      .sort(byModelThenDate);
    const { page, pageSize } = pagingOf(req);
    const answer = paginate(rows, page, pageSize);
    return ok({ items: answer.items.map(viewOf), total: answer.total });
  }),

  'GET /api/admin/usage/price-batches/pending': guard('COST:VIEW', () => {
    const items = costState.batches
      .filter((b) => b.status === 'PENDING_REVIEW')
      .sort(byModelThenDate)
      .map((b) => {
        const active = activeToday(modelKey(b));
        return { ...viewOf(b), active: active ? viewOf(active) : null };
      });
    return ok({ items });
  }),

  'GET /api/admin/usage/models': guard('COST:VIEW', (req) => {
    const rows = [...costState.models].sort((a, b) =>
      `${a.resourceType}\u0000${a.provider}\u0000${a.model}` <
      `${b.resourceType}\u0000${b.provider}\u0000${b.model}`
        ? -1
        : 1,
    );
    const { page, pageSize } = pagingOf(req);
    const answer = paginate(rows, page, pageSize);
    return ok({
      items: answer.items.map((m) => ({ ...m, hasActivePrice: hasActivePrice(m) })),
      total: answer.total,
    });
  }),

  'POST /api/admin/usage/prices': guard('COST:PRICE', (req) => {
    const body = bodyOf(req);
    const problems: Detail[] = [];
    const resourceType = text(body.resourceType);
    if (!(resourceType in UNITS)) problems.push({ ref: 'resourceType', reason: 'OUT_OF_RANGE' });
    else if (body.unit !== UNITS[resourceType])
      problems.push({ ref: 'unit', reason: 'OUT_OF_RANGE' });
    const provider = trimSpec(text(body.provider));
    const model = trimSpec(text(body.model));
    for (const [ref, value] of [
      ['provider', provider],
      ['model', model],
    ] as const) {
      const length = countCodePoints(value);
      if (length < 1 || length > 128)
        problems.push({ ref, reason: length === 0 ? 'EMPTY_NOT_ALLOWED' : 'TOO_LONG' });
    }
    if (!allowedCurrency(body.currency)) problems.push({ ref: 'currency', reason: 'OUT_OF_RANGE' });
    const effectiveFrom = day(body.effectiveFrom);
    if (effectiveFrom === null) problems.push({ ref: 'effectiveFrom', reason: 'OUT_OF_RANGE' });
    if (resourceType === 'LLM') {
      if (bandsProblem(body.bands)) problems.push({ ref: 'bands', reason: 'OUT_OF_RANGE' });
      else problems.push(...bandPricesProblems(body.bands as unknown[]));
      if (body.unitPrice !== undefined && body.unitPrice !== null)
        problems.push({ ref: 'unitPrice', reason: 'OUT_OF_RANGE' });
    } else if (resourceType in UNITS) {
      if (!priceOk(body.unitPrice)) problems.push({ ref: 'unitPrice', reason: 'OUT_OF_RANGE' });
      if (body.bands !== undefined && body.bands !== null)
        problems.push({ ref: 'bands', reason: 'OUT_OF_RANGE' });
    }
    if (problems.length > 0)
      throw invalidRequest(`invalid price: ${problems.map((p) => p.ref).join(', ')}`, problems);

    const created: MockBatch = {
      batchId: newBatchId(),
      resourceType,
      provider,
      model,
      unit: UNITS[resourceType],
      effectiveFrom: effectiveFrom as string,
      currency: text(body.currency),
      status: 'ACTIVE',
      source: 'MANUAL',
      confirmedBy: req.admin.id,
      confirmedByUsername: req.admin.username,
      confirmedAt: new Date().toISOString(),
      reviewedBy: null,
      reviewedByUsername: null,
      reviewedAt: null,
      reviewNote: null,
      createdAt: new Date().toISOString(),
      bands: resourceType === 'LLM' ? (structuredClone(body.bands) as MockBand[]) : null,
      unitPrice: resourceType === 'LLM' ? null : text(body.unitPrice),
    };
    supersedeSameDay(created);
    costState.batches.push(created);
    return ok({ batchId: created.batchId });
  }),

  'POST /api/admin/usage/price-batches/:batchId/confirm': guard('COST:PRICE', (req) => {
    const target = batchOf(req.params.batchId);
    requireStatus(target, 'PENDING_REVIEW');
    const body = bodyOf(req);
    const problems: Detail[] = [];
    let effectiveFrom = target.effectiveFrom;
    let currency = target.currency;
    if (body.effectiveFrom !== undefined) {
      const picked = day(body.effectiveFrom);
      if (picked === null) problems.push({ ref: 'effectiveFrom', reason: 'OUT_OF_RANGE' });
      else effectiveFrom = picked;
    }
    if (body.currency !== undefined) {
      if (allowedCurrency(body.currency)) currency = text(body.currency);
      else problems.push({ ref: 'currency', reason: 'OUT_OF_RANGE' });
    }
    // The bands are checked again on confirm (contract 14.2).
    if (target.bands && bandsProblem(target.bands))
      problems.push({ ref: 'bands', reason: 'OUT_OF_RANGE' });
    if (problems.length > 0)
      throw invalidRequest(`cannot confirm: ${problems.map((p) => p.ref).join(', ')}`, problems);
    target.effectiveFrom = effectiveFrom;
    target.currency = currency;
    target.status = 'ACTIVE';
    target.confirmedBy = req.admin.id;
    target.confirmedByUsername = req.admin.username;
    target.confirmedAt = new Date().toISOString();
    supersedeSameDay(target);
    return ok(null);
  }),

  'POST /api/admin/usage/price-batches/:batchId/reject': guard('COST:PRICE', (req) => {
    const target = batchOf(req.params.batchId);
    requireStatus(target, 'PENDING_REVIEW');
    target.reviewNote = note(req);
    target.status = 'REJECTED';
    target.reviewedBy = req.admin.id;
    target.reviewedByUsername = req.admin.username;
    target.reviewedAt = new Date().toISOString();
    return ok(null);
  }),

  'POST /api/admin/usage/price-batches/:batchId/retire': guard('COST:PRICE', (req) => {
    const target = batchOf(req.params.batchId);
    requireStatus(target, 'ACTIVE');
    target.reviewNote = note(req);
    target.status = 'RETIRED';
    target.reviewedBy = req.admin.id;
    target.reviewedByUsername = req.admin.username;
    target.reviewedAt = new Date().toISOString();
    return ok(null);
  }),

  'PUT /api/admin/usage/models/:id': guard('COST:PRICE', (req) => {
    const target: MockUsageModel | undefined = costState.models.find((m) => m.id === req.params.id);
    if (!target) throw new MockHttpError(404, 'RESOURCE_NOT_FOUND', 'There is no such model');
    const body = bodyOf(req);
    const problems: Detail[] = [];
    const adapter = body.syncAdapter ?? null;
    if (adapter !== null && (adapter !== 'DASHSCOPE_INTL' || target.resourceType !== 'LLM')) {
      problems.push({ ref: 'syncAdapter', reason: 'OUT_OF_RANGE' });
    }
    const syncModelId = trimSpec(text(body.syncModelId));
    const length = countCodePoints(syncModelId);
    if (length < 1 || length > 128)
      problems.push({
        ref: 'syncModelId',
        reason: length === 0 ? 'EMPTY_NOT_ALLOWED' : 'TOO_LONG',
      });
    if (problems.length > 0) throw invalidRequest('invalid model registration', problems);
    target.syncAdapter = adapter as string | null;
    target.syncModelId = syncModelId;
    return ok(null);
  }),
};
