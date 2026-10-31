import { beforeEach, describe, expect, it } from 'vitest';
import type { PermissionCode } from '../src/access/permissionCodes';
import { resetConfigStore, saved } from './_core/configStore';
import { BATCH, costState, MODEL, resetCostStore } from './_core/costData';
import type { MockReq, MockRes } from './_core/http';
import { issueToken, resetStore } from './_core/store';
import { adminOf, bearer, call } from './_core/testing';
import cost from './cost.mock';

beforeEach(() => {
  resetStore();
  resetCostStore();
  resetConfigStore();
});

type H = (req: MockReq, res: MockRes) => unknown;
const h = (name: string) => (cost as unknown as Record<string, H>)[name];

const PRICES = 'GET /api/admin/usage/prices';
const PENDING = 'GET /api/admin/usage/price-batches/pending';
const MODELS = 'GET /api/admin/usage/models';
const CREATE = 'POST /api/admin/usage/prices';
const CONFIRM = 'POST /api/admin/usage/price-batches/:batchId/confirm';
const REJECT = 'POST /api/admin/usage/price-batches/:batchId/reject';
const RETIRE = 'POST /api/admin/usage/price-batches/:batchId/retire';
const PUT_MODEL = 'PUT /api/admin/usage/models/:id';

const tokenOf = (codes?: PermissionCode[]) => {
  const admin = adminOf(codes ? 'support' : 'root');
  if (codes) admin.permissions = codes;
  return bearer(issueToken(admin).token).authorization;
};
const get = (name: string, query: Record<string, unknown> = {}, codes?: PermissionCode[]) =>
  call(h(name), { headers: { authorization: tokenOf(codes) }, query });
const write = (
  name: string,
  params: Record<string, string>,
  body: unknown,
  codes?: PermissionCode[],
) => call(h(name), { headers: { authorization: tokenOf(codes) }, params, body });

type Batch = {
  batchId: string;
  resourceType: string;
  provider: string;
  model: string;
  unit: string;
  effectiveFrom: string;
  currency: string;
  status: string;
  bands:
    | {
        inputMinTokens: number;
        inputMaxTokens: number | null;
        inputPrice: string;
        cachedInputPrice: string | null;
        outputPrice: string;
      }[]
    | null;
  unitPrice: string | null;
  reviewNote: string | null;
  reviewedByUsername: string | null;
  confirmedByUsername: string | null;
};

const allPrices = async (query: Record<string, unknown> = {}) =>
  (await get(PRICES, { pageSize: '200', ...query })).body.data.items as Batch[];

const llmBody = (over: Record<string, unknown> = {}) => ({
  resourceType: 'LLM',
  provider: 'provider-z.example',
  model: 'model-z',
  unit: 'TOKENS_1M',
  effectiveFrom: '2026-10-01',
  currency: 'USD',
  bands: [
    {
      inputMinTokens: 0,
      inputMaxTokens: 1000,
      inputPrice: '0.4',
      cachedInputPrice: null,
      outputPrice: '1.2',
    },
    {
      inputMinTokens: 1001,
      inputMaxTokens: null,
      inputPrice: '0.8',
      cachedInputPrice: '0.2',
      outputPrice: '2.4',
    },
  ],
  ...over,
});

describe('the price endpoints of the mock backend', () => {
  it('serves exactly the endpoints of the contract (14.2 and 17.4, the cost row)', () => {
    expect(Object.keys(cost).sort()).toEqual(
      [PRICES, PENDING, MODELS, CREATE, CONFIRM, REJECT, RETIRE, PUT_MODEL].sort(),
    );
  });

  it('needs a sign-in; reads need COST:VIEW, writes need COST:PRICE', async () => {
    expect((await call(h(PRICES), {})).status).toBe(401);
    for (const name of [PRICES, PENDING, MODELS]) {
      expect((await get(name, {}, ['COST:PRICE'])).status, name).toBe(403);
      expect((await get(name, {}, ['COST:VIEW'])).status, name).toBe(200);
    }
    const some = BATCH.pendingLlm;
    for (const [name, params, body] of [
      [CREATE, {}, llmBody()],
      [CONFIRM, { batchId: some }, {}],
      [REJECT, { batchId: some }, { note: 'x' }],
      [RETIRE, { batchId: BATCH.activeLlm }, { note: 'x' }],
      [PUT_MODEL, { id: MODEL.llmMain }, { syncAdapter: null, syncModelId: 'm' }],
    ] as const) {
      const denied = await write(name, { ...params }, body, ['COST:VIEW']);
      expect(denied.status, name).toBe(403);
      expect(denied.body.code).toBe('ADMIN_FORBIDDEN');
    }
  });

  it('lists the batches in the contract shape, by resource type, provider, model, unit, newest effective date first within a model', async () => {
    const items = await allPrices();
    expect(Object.keys(items[0]).sort()).toEqual(
      [
        'batchId',
        'resourceType',
        'provider',
        'model',
        'unit',
        'effectiveFrom',
        'currency',
        'status',
        'source',
        'confirmedBy',
        'confirmedByUsername',
        'confirmedAt',
        'reviewedBy',
        'reviewedByUsername',
        'reviewedAt',
        'reviewNote',
        'createdAt',
        'bands',
        'unitPrice',
      ].sort(),
    );
    const key = (b: Batch) => [b.resourceType, b.provider, b.model, b.unit].join('\u0000');
    for (let i = 1; i < items.length; i += 1) {
      if (key(items[i - 1]) === key(items[i])) {
        expect(items[i - 1].effectiveFrom >= items[i].effectiveFrom).toBe(true);
      } else {
        expect(key(items[i - 1]) < key(items[i])).toBe(true);
      }
    }
  });

  it('LLM batches have bands and no unit price, the others a unit price and no bands; prices are strings', async () => {
    const items = await allPrices();
    for (const b of items) {
      if (b.resourceType === 'LLM') {
        expect(b.unitPrice).toBeNull();
        expect(Array.isArray(b.bands)).toBe(true);
        for (const band of b.bands ?? []) {
          expect(typeof band.inputPrice).toBe('string');
          expect(typeof band.outputPrice).toBe('string');
        }
      } else {
        expect(b.bands).toBeNull();
        expect(typeof b.unitPrice).toBe('string');
      }
    }
    const tiny = items.find((b) => b.batchId === BATCH.activeArabic) as Batch;
    expect(tiny.bands?.[0].inputPrice).toBe('0.0000000001');
  });

  it('filters by resource type, model and status, and pages', async () => {
    expect(
      (await allPrices({ resourceType: 'CLOUD_RENDER' })).every(
        (b) => b.resourceType === 'CLOUD_RENDER',
      ),
    ).toBe(true);
    expect((await allPrices({ status: 'REJECTED' })).every((b) => b.status === 'REJECTED')).toBe(
      true,
    );
    expect((await allPrices({ model: 'model-large-1' })).length).toBeGreaterThan(3);
    const second = await get(PRICES, { page: '2', pageSize: '3' });
    expect(second.body.data.items).toHaveLength(3);
    expect(second.body.data.total).toBe(costState.batches.length);
    const bad = await get(PRICES, { pageSize: '201' });
    expect(bad.status).toBe(400);
    expect(bad.body.data.details).toEqual([{ ref: 'pageSize', reason: 'OUT_OF_RANGE' }]);
    const status = await get(PRICES, { status: 'NOPE' });
    expect(status.status).toBe(400);
  });

  it('has history in every state, with the notes and who reviewed', async () => {
    const items = await allPrices({ model: 'model-large-1' });
    const states = new Set(items.map((b) => b.status));
    for (const s of ['ACTIVE', 'SUPERSEDED', 'REJECTED', 'RETIRED', 'PENDING_REVIEW'])
      expect(states.has(s), s).toBe(true);
    const rejected = items.find((b) => b.status === 'REJECTED') as Batch;
    expect(rejected.reviewNote).toBeTruthy();
    expect(rejected.reviewedByUsername).toBeTruthy();
  });

  it('lists the pending batches, each with the batch in force today (or null)', async () => {
    const { items } = (await get(PENDING)).body.data as {
      items: (Batch & { active: Batch | null })[];
    };
    expect(items.length).toBeGreaterThanOrEqual(4);
    expect(items.every((b) => b.status === 'PENDING_REVIEW')).toBe(true);
    const llm = items.find((b) => b.batchId === BATCH.pendingLlm) as Batch & { active: Batch };
    expect(llm.active.batchId).toBe(BATCH.activeLlm);
    expect(llm.active.status).toBe('ACTIVE');
    expect(llm.bands).toHaveLength(3);
    expect(llm.active.bands).toHaveLength(2);
    expect(
      (items.find((b) => b.batchId === BATCH.pendingNoActive) as { active: unknown }).active,
    ).toBeNull();
  });

  it('does not count a batch that starts in the future as the one in force', async () => {
    const { items } = (await get(PENDING)).body.data as {
      items: (Batch & { active: Batch | null })[];
    };
    const video = costState.batches.find((b) => b.batchId === BATCH.futureVideo) as Batch;
    expect(video.effectiveFrom > new Date().toISOString().slice(0, 10)).toBe(true);
    const pendingVideo = items.find((b) => b.model === video.model);
    if (pendingVideo) expect(pendingVideo.active?.batchId).not.toBe(BATCH.futureVideo);
  });

  it('lists the models with hasActivePrice, which is false for a model with no batch in force', async () => {
    const { items, total } = (await get(MODELS, { pageSize: '200' })).body.data;
    expect(total).toBe(costState.models.length);
    expect(Object.keys(items[0]).sort()).toEqual(
      [
        'id',
        'resourceType',
        'provider',
        'model',
        'syncAdapter',
        'syncModelId',
        'firstSeenAt',
        'lastSeenAt',
        'hasActivePrice',
      ].sort(),
    );
    const by = (id: string) => items.find((m: { id: string }) => m.id === id);
    expect(by(MODEL.llmMain).hasActivePrice).toBe(true);
    expect(by(MODEL.matting).hasActivePrice).toBe(false);
    expect(by(MODEL.llmThai).hasActivePrice).toBe(false);
    expect(items.some((m: { resourceType: string }) => m.resourceType === 'AGE_ESTIMATION')).toBe(
      true,
    );
  });
});

describe('creating a batch by hand', () => {
  it('saves an ACTIVE batch from a MANUAL source with the prices unchanged, by the signed-in administrator', async () => {
    const answer = await write(
      CREATE,
      {},
      llmBody({
        bands: [
          {
            inputMinTokens: 0,
            inputMaxTokens: null,
            inputPrice: '0.0000000001',
            cachedInputPrice: null,
            outputPrice: '999999.9999999999',
          },
        ],
      }),
    );
    expect(answer.status).toBe(200);
    const saved = (await allPrices({ model: 'model-z' }))[0];
    expect(saved.status).toBe('ACTIVE');
    expect(saved.bands?.[0].inputPrice).toBe('0.0000000001');
    expect(saved.bands?.[0].outputPrice).toBe('999999.9999999999');
    expect(saved.confirmedByUsername).toBe('root');
  });

  it('saves a unit price for another type and takes the unit from the type', async () => {
    const body = {
      resourceType: 'IMAGE_TO_VIDEO',
      provider: 'p',
      model: 'v',
      unit: 'SECOND',
      effectiveFrom: '2026-10-01',
      currency: 'USD',
      unitPrice: '0.0000000001',
    };
    expect((await write(CREATE, {}, body)).status).toBe(200);
    expect((await allPrices({ model: 'v' }))[0].unitPrice).toBe('0.0000000001');
    const wrongUnit = await write(CREATE, {}, { ...body, unit: 'MINUTE' });
    expect(wrongUnit.status).toBe(400);
    expect(wrongUnit.body.data.details).toEqual([{ ref: 'unit', reason: 'OUT_OF_RANGE' }]);
  });

  it('a new batch for the same model and effective date supersedes the old one in force', async () => {
    await write(CREATE, {}, llmBody());
    const first = (await allPrices({ model: 'model-z' }))[0];
    await write(CREATE, {}, llmBody());
    const rows = await allPrices({ model: 'model-z' });
    expect(rows.filter((b) => b.status === 'ACTIVE')).toHaveLength(1);
    expect(rows.find((b) => b.batchId === first.batchId)?.status).toBe('SUPERSEDED');
  });

  it('refuses a currency that is not allowed', async () => {
    const answer = await write(CREATE, {}, llmBody({ currency: 'EUR' }));
    expect(answer.status).toBe(400);
    expect(answer.body.data.details).toEqual([{ ref: 'currency', reason: 'OUT_OF_RANGE' }]);
  });

  it('refuses bands with a gap, an overlap, a first band that does not start at 0 and a last band with a limit', async () => {
    const band = (min: number, max: number | null) => ({
      inputMinTokens: min,
      inputMaxTokens: max,
      inputPrice: '1',
      cachedInputPrice: null,
      outputPrice: '1',
    });
    for (const bands of [
      [band(0, 10), band(12, null)],
      [band(0, 10), band(10, null)],
      [band(1, null)],
      [band(0, 10)],
    ]) {
      const answer = await write(CREATE, {}, llmBody({ bands }));
      expect(answer.status).toBe(400);
      expect(answer.body.data.details[0].ref).toBe('bands');
    }
  });

  it('refuses a price that is negative, in scientific notation, has eleven decimals or is above 1000000', async () => {
    for (const price of ['-1', '1e-3', '0.00000000001', '1000000.01', '']) {
      const answer = await write(
        CREATE,
        {},
        llmBody({
          bands: [
            {
              inputMinTokens: 0,
              inputMaxTokens: null,
              inputPrice: price,
              cachedInputPrice: null,
              outputPrice: '1',
            },
          ],
        }),
      );
      expect(answer.status, price).toBe(400);
    }
    const num = await write(
      CREATE,
      {},
      llmBody({
        bands: [
          {
            inputMinTokens: 0,
            inputMaxTokens: null,
            inputPrice: 0.5,
            cachedInputPrice: null,
            outputPrice: '1',
          },
        ],
      }),
    );
    expect(num.status).toBe(400);
  });

  it('refuses an empty provider or model and an unknown type', async () => {
    expect((await write(CREATE, {}, llmBody({ provider: '  ' }))).status).toBe(400);
    expect((await write(CREATE, {}, llmBody({ model: 'x'.repeat(129) }))).status).toBe(400);
    expect((await write(CREATE, {}, llmBody({ resourceType: 'TTS' }))).status).toBe(400);
  });
});

describe('confirm, reject and retire', () => {
  it('confirms a pending batch with the checked date and currency: it is ACTIVE, the batch in force on that date is superseded', async () => {
    const answer = await write(
      CONFIRM,
      { batchId: BATCH.pendingLlm },
      { effectiveFrom: '2026-09-01', currency: 'USD' },
    );
    expect(answer.status).toBe(200);
    const rows = await allPrices({ model: 'model-large-1' });
    expect(rows.find((b) => b.batchId === BATCH.pendingLlm)).toMatchObject({
      status: 'ACTIVE',
      effectiveFrom: '2026-09-01',
      confirmedByUsername: 'root',
    });
    expect(rows.find((b) => b.batchId === BATCH.activeLlm)?.status).toBe('SUPERSEDED');
  });

  it('refuses to confirm a batch with a gap in its bands, with the reason', async () => {
    const answer = await write(CONFIRM, { batchId: BATCH.pendingGap }, {});
    expect(answer.status).toBe(400);
    expect(answer.body.code).toBe('INVALID_REQUEST');
    expect(answer.body.data.details[0].ref).toBe('bands');
    expect(costState.batches.find((b) => b.batchId === BATCH.pendingGap)?.status).toBe(
      'PENDING_REVIEW',
    );
  });

  it('refuses a currency that is not allowed and a bad date when confirming', async () => {
    const currency = await write(CONFIRM, { batchId: BATCH.pendingLlm }, { currency: 'EUR' });
    expect(currency.body.data.details).toEqual([{ ref: 'currency', reason: 'OUT_OF_RANGE' }]);
    const date = await write(
      CONFIRM,
      { batchId: BATCH.pendingLlm },
      { effectiveFrom: '2026-02-30' },
    );
    expect(date.body.data.details).toEqual([{ ref: 'effectiveFrom', reason: 'OUT_OF_RANGE' }]);
  });

  it('confirm and reject need a pending batch (409 with the current status), retire an ACTIVE one; an unknown batch is 404', async () => {
    const confirmActive = await write(CONFIRM, { batchId: BATCH.activeLlm }, {});
    expect(confirmActive.status).toBe(409);
    expect(confirmActive.body.code).toBe('INVALID_STATE');
    expect(confirmActive.body.data).toEqual({ status: 'ACTIVE' });
    expect((await write(REJECT, { batchId: BATCH.activeLlm }, { note: 'x' })).body.data).toEqual({
      status: 'ACTIVE',
    });
    const retirePending = await write(RETIRE, { batchId: BATCH.pendingLlm }, { note: 'x' });
    expect(retirePending.status).toBe(409);
    expect(retirePending.body.data).toEqual({ status: 'PENDING_REVIEW' });
    for (const name of [CONFIRM, REJECT, RETIRE]) {
      expect((await write(name, { batchId: 'nope' }, { note: 'x' })).status, name).toBe(404);
    }
  });

  it('a batch confirmed once cannot be confirmed again', async () => {
    expect((await write(CONFIRM, { batchId: BATCH.pendingImage }, {})).status).toBe(200);
    const again = await write(CONFIRM, { batchId: BATCH.pendingImage }, {});
    expect(again.status).toBe(409);
    expect(again.body.data).toEqual({ status: 'ACTIVE' });
  });

  it('rejects with a note of 1 to 500 characters (trimmed), keeping who and when', async () => {
    expect((await write(REJECT, { batchId: BATCH.pendingLlm }, { note: '   ' })).status).toBe(400);
    expect((await write(REJECT, { batchId: BATCH.pendingLlm }, {})).status).toBe(400);
    expect(
      (await write(REJECT, { batchId: BATCH.pendingLlm }, { note: 'x'.repeat(501) })).status,
    ).toBe(400);
    expect(
      (await write(REJECT, { batchId: BATCH.pendingLlm }, { note: ` ${'ก'.repeat(500)} ` })).status,
    ).toBe(200);
    const row = (await allPrices({ model: 'model-large-1' })).find(
      (b) => b.batchId === BATCH.pendingLlm,
    ) as Batch;
    expect(row.status).toBe('REJECTED');
    expect(row.reviewNote).toBe('ก'.repeat(500));
    expect(row.reviewedByUsername).toBe('root');
  });

  it('retires an ACTIVE batch with a note; the model then has no batch in force', async () => {
    expect((await write(RETIRE, { batchId: BATCH.activeArabic }, { note: '' })).status).toBe(400);
    expect(
      (await write(RETIRE, { batchId: BATCH.activeArabic }, { note: 'خطأ في الإدخال' })).status,
    ).toBe(200);
    const row = (await allPrices()).find((b) => b.batchId === BATCH.activeArabic) as Batch;
    expect(row.status).toBe('RETIRED');
    expect(row.reviewNote).toBe('خطأ في الإدخال');
    const models = (await get(MODELS, { pageSize: '200' })).body.data.items as {
      id: string;
      hasActivePrice: boolean;
    }[];
    expect(models.find((m) => m.id === MODEL.llmArabic)?.hasActivePrice).toBe(false);
  });
});

describe('the model registration', () => {
  it('sets the adapter and the model name for an LLM model, and clears the adapter with null', async () => {
    expect(
      (
        await write(
          PUT_MODEL,
          { id: MODEL.llmArabic },
          { syncAdapter: 'DASHSCOPE_INTL', syncModelId: 'sync-name' },
        )
      ).status,
    ).toBe(200);
    const model = costState.models.find((m) => m.id === MODEL.llmArabic);
    expect(model).toMatchObject({ syncAdapter: 'DASHSCOPE_INTL', syncModelId: 'sync-name' });
    expect(
      (
        await write(
          PUT_MODEL,
          { id: MODEL.llmArabic },
          { syncAdapter: null, syncModelId: 'sync-name' },
        )
      ).status,
    ).toBe(200);
    expect(costState.models.find((m) => m.id === MODEL.llmArabic)?.syncAdapter).toBeNull();
  });

  it('refuses an adapter for a model that is not LLM, an unknown adapter, an empty model name and an unknown model', async () => {
    const other = await write(
      PUT_MODEL,
      { id: MODEL.matting },
      { syncAdapter: 'DASHSCOPE_INTL', syncModelId: 'm' },
    );
    expect(other.status).toBe(400);
    expect(other.body.data.details).toEqual([{ ref: 'syncAdapter', reason: 'OUT_OF_RANGE' }]);
    expect(
      (await write(PUT_MODEL, { id: MODEL.llmMain }, { syncAdapter: 'OTHER', syncModelId: 'm' }))
        .status,
    ).toBe(400);
    expect(
      (await write(PUT_MODEL, { id: MODEL.llmMain }, { syncAdapter: null, syncModelId: ' ' }))
        .status,
    ).toBe(400);
    expect(
      (await write(PUT_MODEL, { id: 'nope' }, { syncAdapter: null, syncModelId: 'm' })).status,
    ).toBe(404);
  });
});

// Ranges of the scripts, by code point (no raw control characters in the source).
const inRange = (text: string, from: number, to: number) =>
  [...text].some((c) => (c.codePointAt(0) as number) >= from && (c.codePointAt(0) as number) <= to);

describe('the sample data', () => {
  it('has model names in all seven languages, an emoji and one of 5000 characters without a space', () => {
    const names = costState.models.map((m) => m.model);
    expect(names.some((n) => inRange(n, 0x0e00, 0x0e7f))).toBe(true);
    expect(names.some((n) => inRange(n, 0x0600, 0x06ff))).toBe(true);
    expect(names.some((n) => inRange(n, 0x4e00, 0x9fff))).toBe(true);
    expect(names.some((n) => /[ôơư]/.test(n))).toBe(true);
    expect(names.some((n) => /[ñé]|modelo/.test(n))).toBe(true);
    expect(names.some((n) => /besar/.test(n))).toBe(true);
    expect(names.some((n) => n.length >= 5000 && !/\s/.test(n))).toBe(true);
    expect(names.some((n) => /\p{Extended_Pictographic}/u.test(n))).toBe(true);
  });

  it('can be put back', async () => {
    await write(RETIRE, { batchId: BATCH.activeLlm }, { note: 'x' });
    resetCostStore();
    expect(costState.batches.find((b) => b.batchId === BATCH.activeLlm)?.status).toBe('ACTIVE');
  });
});

describe('the final currency of a confirmed batch must be in usage_price.allowed_currencies', () => {
  const ALLOWED = 'usage_price.allowed_currencies';
  const allow = (...codes: string[]) =>
    saved.set(ALLOWED, { value: codes, updatedAt: '', updatedBy: '', updatedByUsername: '' });
  const statusOf = (id: string) => costState.batches.find((b) => b.batchId === id)?.status;
  const pending = (id: string) => costState.batches.find((b) => b.batchId === id);

  it('refuses a batch whose own currency is not allowed when the body gives none, and the batch stays PENDING_REVIEW', async () => {
    (pending(BATCH.pendingImage) as { currency: string }).currency = 'EUR';
    const answer = await write(CONFIRM, { batchId: BATCH.pendingImage }, {});
    expect(answer.status).toBe(400);
    expect(answer.body.code).toBe('INVALID_REQUEST');
    expect(answer.body.message).toBe('currency must be one of usage_price.allowed_currencies');
    expect(answer.body.data.details).toEqual([{ ref: 'currency', reason: 'OUT_OF_RANGE' }]);
    expect(statusOf(BATCH.pendingImage)).toBe('PENDING_REVIEW');
  });

  it('takes a currency of the body that is allowed, even where the batch has another one', async () => {
    (pending(BATCH.pendingImage) as { currency: string }).currency = 'EUR';
    const answer = await write(CONFIRM, { batchId: BATCH.pendingImage }, { currency: 'USD' });
    expect(answer.status).toBe(200);
    expect(pending(BATCH.pendingImage)).toMatchObject({ status: 'ACTIVE', currency: 'USD' });
  });

  it('reads the list from the setting: a currency added to it is accepted, a currency taken out is refused', async () => {
    allow('USD', 'EUR');
    expect((await write(CONFIRM, { batchId: BATCH.pendingLlm }, { currency: 'EUR' })).status).toBe(
      200,
    );
    allow('EUR');
    const refused = await write(CONFIRM, { batchId: BATCH.pendingImage }, {});
    expect(refused.status).toBe(400);
    expect(refused.body.data.details).toEqual([{ ref: 'currency', reason: 'OUT_OF_RANGE' }]);
    expect(statusOf(BATCH.pendingImage)).toBe('PENDING_REVIEW');
  });

  it('checks in the order: the batch (404), the date, the currency, the bands of an LLM price, then the state (409)', async () => {
    const bad = { effectiveFrom: '2026-02-30', currency: 'EUR' };
    expect((await write(CONFIRM, { batchId: 'nope' }, bad)).status).toBe(404);
    const date = await write(CONFIRM, { batchId: BATCH.pendingGap }, bad);
    expect(date.body.data.details).toEqual([{ ref: 'effectiveFrom', reason: 'OUT_OF_RANGE' }]);
    const currency = await write(CONFIRM, { batchId: BATCH.pendingGap }, { currency: 'EUR' });
    expect(currency.body.data.details).toEqual([{ ref: 'currency', reason: 'OUT_OF_RANGE' }]);
    const bands = await write(CONFIRM, { batchId: BATCH.pendingGap }, {});
    expect(bands.body.data.details[0].ref).toBe('bands');
    // a batch that is not pending answers the currency first, and 409 only for a good body
    const activeBad = await write(CONFIRM, { batchId: BATCH.activeLlm }, { currency: 'EUR' });
    expect(activeBad.status).toBe(400);
    const activeGood = await write(CONFIRM, { batchId: BATCH.activeLlm }, { currency: 'USD' });
    expect(activeGood.status).toBe(409);
    expect(activeGood.body.data).toEqual({ status: 'ACTIVE' });
  });

  it('keeps the batch exactly as it was when the currency is refused', async () => {
    const before = JSON.stringify(pending(BATCH.pendingLlm));
    await write(CONFIRM, { batchId: BATCH.pendingLlm }, { currency: 'THB' });
    expect(JSON.stringify(pending(BATCH.pendingLlm))).toBe(before);
  });
});
