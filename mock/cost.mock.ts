// The cost endpoints of the mock backend (contract 14.2 and 17.4, the cost row): the price batches,
// the pending batches with the batch in force, the model registration, and the writes (enter by
// hand, confirm, reject, retire). Reads need `COST:VIEW`, writes `COST:PRICE`. The report itself
// (`GET /stats/usage-cost`) is in stats.mock.ts. The data is in _core/costData.ts.
import { countCodePoints } from '../src/utils/codePoints';
import { trimSpec } from '../src/utils/trimSpec';
import { guard } from './_core/auth';
import { currentValue } from './_core/configStore';
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
const NAME_MAX = 128;
const PRICE = /^\d+(\.\d{1,10})?$/;
const PRICE_MAX_UNITS = 10_000_000_000_000_000n; // 1000000 with ten decimals

type Detail = { ref: string; reason: string };

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

/** A query parameter that was given (an empty one too), else undefined. */
const given = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

const day = (value: unknown): string | null => {
  const s = typeof value === 'string' ? value : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  // The backend takes the years 1 to 9999 only.
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s || s < '0001' ? null : s;
};

/** A price as the contract wants it: a string, digits only, up to ten decimals, at most 1000000. */
function priceOk(value: unknown): boolean {
  if (typeof value !== 'string' || !PRICE.test(value)) return false;
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole + fraction.padEnd(10, '0')) <= PRICE_MAX_UNITS;
}

const isBound = (n: unknown): n is number =>
  typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;

/** A string value, or null when the field is missing or not a string (the backend reads every text field so). */
const str = (value: unknown): string | null => (typeof value === 'string' ? value : null);

const problem = (ref: string, reason: string): Detail => ({ ref, reason });

/**
 * One bound of a band as typed: a whole number from 0 up. Nothing is `EMPTY_NOT_ALLOWED`, a number
 * with a fraction (or a text) `NOT_AN_INTEGER`, a negative or too large whole number `OUT_OF_RANGE`.
 */
function boundReason(value: unknown): string | null {
  if (value === null || value === undefined) return 'EMPTY_NOT_ALLOWED';
  if (typeof value !== 'number' || !Number.isInteger(value)) return 'NOT_AN_INTEGER';
  return isBound(value) ? null : 'OUT_OF_RANGE';
}

/**
 * A price as typed: not given is `EMPTY_NOT_ALLOWED`, anything that is not a price in the contract's
 * form (an empty text included) `OUT_OF_RANGE`. The cached input price is the one that may be left out.
 */
function priceReason(value: unknown, optional: boolean): string | null {
  if (value === null || value === undefined) return optional ? null : 'EMPTY_NOT_ALLOWED';
  return priceOk(value) ? null : 'OUT_OF_RANGE';
}

/**
 * The fields of one band, in the order the backend reads them: the lower bound, the upper bound (when
 * given), the input price, the cached input price, the output price. The first wrong one is the answer.
 */
function bandProblem(raw: unknown, i: number): Detail | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
    return problem(`bands[${i}]`, 'OUT_OF_RANGE');
  const b = raw as Partial<MockBand>;
  const minReason = boundReason(b.inputMinTokens);
  if (minReason) return problem(`bands[${i}].inputMinTokens`, minReason);
  if (b.inputMaxTokens !== null && b.inputMaxTokens !== undefined) {
    const maxReason = boundReason(b.inputMaxTokens);
    if (maxReason) return problem(`bands[${i}].inputMaxTokens`, maxReason);
  }
  for (const [field, optional] of [
    ['inputPrice', false],
    ['cachedInputPrice', true],
    ['outputPrice', false],
  ] as const) {
    const reason = priceReason(b[field], optional);
    if (reason) return problem(`bands[${i}].${field}`, reason);
  }
  return null;
}

/**
 * The boundary rule of 14.2, checked on the bands by lower bound once every field is fine: the first
 * starts at 0, each next starts at the previous upper bound plus 1, only the last has no upper bound.
 * A gap and an overlap have no reason of their own: the answer is `OUT_OF_RANGE` of `bands`, with no index.
 */
function bandsOutOfOrder(bands: MockBand[]): boolean {
  const sorted = [...bands].sort((a, b) => a.inputMinTokens - b.inputMinTokens);
  if (sorted[0].inputMinTokens !== 0) return true;
  return sorted.some((band, i) => {
    if (i === sorted.length - 1) return band.inputMaxTokens !== null;
    const max = band.inputMaxTokens;
    return max === null || max < band.inputMinTokens || sorted[i + 1].inputMinTokens !== max + 1;
  });
}

/** `provider` and `model`: stripped, then 1 to 128 code points, no NUL. */
function nameReason(stripped: string): string | null {
  const length = countCodePoints(stripped);
  if (length < 1) return 'EMPTY_NOT_ALLOWED';
  return length > NAME_MAX || stripped.includes('\u0000') ? 'OUT_OF_RANGE' : null;
}

/** The bands of an LLM price as the backend reads them: the count, then each band in request order, then the boundary rule. */
function bandsProblem(bands: unknown): Detail | null {
  if (bands === null || bands === undefined || (Array.isArray(bands) && bands.length === 0))
    return problem('bands', 'EMPTY_NOT_ALLOWED');
  if (!Array.isArray(bands)) return problem('bands', 'OUT_OF_RANGE');
  const saved = currentValue('usage_price.max_bands');
  if (bands.length > (typeof saved === 'number' ? saved : MAX_BANDS))
    return problem('bands', 'OUT_OF_RANGE');
  for (let i = 0; i < bands.length; i += 1) {
    const found = bandProblem(bands[i], i);
    if (found) return found;
  }
  return bandsOutOfOrder(bands as MockBand[]) ? problem('bands', 'OUT_OF_RANGE') : null;
}

/** A price as the backend keeps and returns it: at scale 10, so "0.4" comes back as "0.4000000000". */
function atScale10(value: string): string {
  const [whole, fraction = ''] = value.split('.');
  return `${whole}.${fraction.padEnd(10, '0')}`;
}

/** The bands of an LLM price as the backend keeps them: by lower bound, each price at scale 10. */
function bandsAsKept(bands: MockBand[]): MockBand[] {
  return [...structuredClone(bands)]
    .sort((a, b) => a.inputMinTokens - b.inputMinTokens)
    .map((band) => ({
      ...band,
      inputPrice: atScale10(band.inputPrice),
      cachedInputPrice:
        band.cachedInputPrice === null || band.cachedInputPrice === undefined
          ? null
          : atScale10(band.cachedInputPrice),
      outputPrice: atScale10(band.outputPrice),
    }));
}

/**
 * The first thing wrong with `POST /usage/prices`, or null. The backend stops at the first wrong field,
 * so the answer has exactly one detail. Order: the resource type, `provider`, `model`, `unit`,
 * `effectiveFrom`, `currency`, then for an LLM batch `unitPrice` (must be absent) and the bands, for any
 * other batch `bands` (must be absent) and `unitPrice`.
 */
function manualProblem(body: Record<string, unknown>): Detail | null {
  const typeText = str(body.resourceType);
  if (typeText === null) return problem('resourceType', 'EMPTY_NOT_ALLOWED');
  if (!Object.hasOwn(UNITS, typeText)) return problem('resourceType', 'OUT_OF_RANGE');
  for (const field of ['provider', 'model'] as const) {
    const reason = nameReason(trimSpec(str(body[field]) ?? ''));
    if (reason) return problem(field, reason);
  }
  const unit = str(body.unit);
  if (unit !== UNITS[typeText])
    return problem('unit', unit === null ? 'EMPTY_NOT_ALLOWED' : 'OUT_OF_RANGE');
  const effectiveFrom = str(body.effectiveFrom);
  if (effectiveFrom === null) return problem('effectiveFrom', 'EMPTY_NOT_ALLOWED');
  if (day(effectiveFrom) === null) return problem('effectiveFrom', 'OUT_OF_RANGE');
  if (str(body.currency) === null) return problem('currency', 'EMPTY_NOT_ALLOWED');
  if (!allowedCurrency(body.currency)) return problem('currency', 'OUT_OF_RANGE');
  if (typeText === 'LLM') {
    if (body.unitPrice !== undefined && body.unitPrice !== null)
      return problem('unitPrice', 'OUT_OF_RANGE');
    return bandsProblem(body.bands);
  }
  if (body.bands !== undefined && body.bands !== null) return problem('bands', 'OUT_OF_RANGE');
  const reason = priceReason(body.unitPrice, false);
  return reason ? problem('unitPrice', reason) : null;
}

/** `usage_price.allowed_currencies` as saved (else its default, else what `GET /meta` lists); compared as written. */
const allowedCurrency = (value: unknown): boolean => {
  const list = currentValue('usage_price.allowed_currencies');
  const allowed: readonly unknown[] = Array.isArray(list) ? list : META_DEFAULTS.allowedCurrencies;
  return typeof value === 'string' && allowed.includes(value);
};

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
    // The filters are checked as the backend does: a filter that is given (an empty one too) must be a
    // known value, answered with a 400 that has no `details` (resourceType, unit, status in this order);
    // `provider` and `model` are stripped and must be 1 to 128 code points, with `details` naming them.
    const resourceType = given(req.query.resourceType);
    const unit = given(req.query.unit);
    const status = given(req.query.status);
    if (resourceType !== undefined && !Object.hasOwn(UNITS, resourceType))
      throw new MockHttpError(400, 'INVALID_REQUEST', 'resourceType is not a known resource type');
    if (unit !== undefined && !Object.values(UNITS).includes(unit))
      throw new MockHttpError(400, 'INVALID_REQUEST', 'unit is not a known unit');
    if (status !== undefined && !STATUSES.includes(status))
      throw new MockHttpError(400, 'INVALID_REQUEST', 'status is not a known status');
    const named = (ref: 'provider' | 'model'): string | undefined => {
      const value = given(req.query[ref]);
      if (value === undefined) return undefined;
      const stripped = trimSpec(value);
      const reason = nameReason(stripped);
      if (reason) throw invalidRequest(`${ref} is not valid`, [problem(ref, reason)]);
      return stripped;
    };
    const provider = named('provider');
    const model = named('model');
    const rows = costState.batches
      .filter((b) => status === undefined || b.status === status)
      .filter((b) => resourceType === undefined || b.resourceType === resourceType)
      .filter((b) => provider === undefined || b.provider === provider)
      .filter((b) => model === undefined || b.model === model)
      .filter((b) => unit === undefined || b.unit === unit)
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

  // `resourceType` (one of the seven) and `hasActivePrice` (`true` or `false`) filter on the server, the
  // total is the number kept. A filter that is given (an empty one too) with any other value is a 400
  // with no details, as for `GET /usage/prices`.
  'GET /api/admin/usage/models': guard('COST:VIEW', (req) => {
    const resourceType = given(req.query.resourceType);
    const asked = given(req.query.hasActivePrice);
    if (resourceType !== undefined && !Object.hasOwn(UNITS, resourceType))
      throw new MockHttpError(400, 'INVALID_REQUEST', 'resourceType is not a known resource type');
    if (asked !== undefined && asked !== 'true' && asked !== 'false')
      throw new MockHttpError(400, 'INVALID_REQUEST', 'hasActivePrice must be true or false');
    const rows = costState.models
      .filter((m) => resourceType === undefined || m.resourceType === resourceType)
      .filter((m) => asked === undefined || hasActivePrice(m) === (asked === 'true'))
      .sort((a, b) =>
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
    // `data.details` = [{ ref: the path of the field, reason }], reasons EMPTY_NOT_ALLOWED, OUT_OF_RANGE, NOT_AN_INTEGER.
    const wrong = manualProblem(body);
    if (wrong) throw invalidRequest('invalid price', [wrong]);
    const resourceType = text(body.resourceType);
    const provider = trimSpec(text(body.provider));
    const model = trimSpec(text(body.model));
    const effectiveFrom = day(body.effectiveFrom);

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
      bands: resourceType === 'LLM' ? bandsAsKept(body.bands as MockBand[]) : null,
      unitPrice: resourceType === 'LLM' ? null : atScale10(text(body.unitPrice)),
    };
    supersedeSameDay(created);
    costState.batches.push(created);
    // the answer is the new batch, in the shape of an item of the list
    return ok(viewOf(created));
  }),

  // Checked in this order, the first that fails answers: the batch (404), the date, the currency the
  // batch ends up with (the body's, else its own) against usage_price.allowed_currencies, the bands of
  // an LLM price, and last the state (409). A refused confirm changes nothing.
  'POST /api/admin/usage/price-batches/:batchId/confirm': guard('COST:PRICE', (req) => {
    const target = batchOf(req.params.batchId);
    const body = bodyOf(req);
    let effectiveFrom = target.effectiveFrom;
    if (body.effectiveFrom !== undefined) {
      const picked = day(body.effectiveFrom);
      if (picked === null)
        throw invalidRequest('effectiveFrom is not valid', [
          { ref: 'effectiveFrom', reason: 'OUT_OF_RANGE' },
        ]);
      effectiveFrom = picked;
    }
    const currency = body.currency !== undefined ? body.currency : target.currency;
    if (!allowedCurrency(currency))
      throw invalidRequest('currency must be one of usage_price.allowed_currencies', [
        { ref: 'currency', reason: 'OUT_OF_RANGE' },
      ]);
    // The bands are checked again on confirm (contract 14.2), with the details of a hand-entered price.
    if (target.bands && bandsOutOfOrder(target.bands))
      throw invalidRequest('cannot confirm: bands', [problem('bands', 'OUT_OF_RANGE')]);
    requireStatus(target, 'PENDING_REVIEW');
    target.effectiveFrom = effectiveFrom;
    target.currency = currency as string;
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
