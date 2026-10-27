// Sample data for the cost endpoints of the mock backend (contract 14.2 and 17.4, the cost row):
// price batches in every state, a pending batch for several models, and the models seen so far.
// The models are named in every language the product targets (Thai, Arabic, Indonesian,
// Vietnamese, Spanish, English, Chinese), with an emoji and one name of 5000 characters without a
// space. Prices are decimal texts, never numbers. State is on `globalThis` so that saving a mock
// file does not lose it, and `resetCostStore` puts the sample data back.

export type MockBand = {
  inputMinTokens: number;
  inputMaxTokens: number | null;
  inputPrice: string;
  cachedInputPrice: string | null;
  outputPrice: string;
};

export type MockBatch = {
  batchId: string;
  resourceType: string;
  provider: string;
  model: string;
  unit: string;
  effectiveFrom: string;
  currency: string;
  status: 'PENDING_REVIEW' | 'ACTIVE' | 'REJECTED' | 'SUPERSEDED' | 'RETIRED';
  source: 'SYNC' | 'MANUAL';
  confirmedBy: string | null;
  confirmedByUsername: string | null;
  confirmedAt: string | null;
  reviewedBy: string | null;
  reviewedByUsername: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  bands: MockBand[] | null;
  unitPrice: string | null;
};

export type MockUsageModel = {
  id: string;
  resourceType: string;
  provider: string;
  model: string;
  syncAdapter: string | null;
  syncModelId: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
};

type CostStore = { batches: MockBatch[]; models: MockUsageModel[]; next: number };

/** The models the tests look for by name (the id is the registration id). */
export const MODEL = {
  llmMain: '1',
  llmArabic: '2',
  llmThai: '3',
  imageEdit: '4',
  video: '5',
  matting: '6',
  cloudRender: '7',
  llmHostile: '8',
  drivingPrep: '9',
  ageEstimation: '10',
} as const;

/** The batches the tests look for by name. */
export const BATCH = {
  activeLlm: 'bt-active-llm',
  supersededLlm: 'bt-superseded-llm',
  rejectedLlm: 'bt-rejected-llm',
  retiredLlm: 'bt-retired-llm',
  pendingLlm: 'bt-pending-llm',
  activeArabic: 'bt-active-arabic',
  pendingGap: 'bt-pending-gap',
  rejectedThai: 'bt-rejected-thai',
  pendingNoActive: 'bt-pending-no-active',
  activeImage: 'bt-active-image',
  pendingImage: 'bt-pending-image',
  activeVideo: 'bt-active-video',
  futureVideo: 'bt-future-video',
  activeRender: 'bt-active-render',
  activeHostile: 'bt-active-hostile',
  activeAge: 'bt-active-age',
} as const;

export const PROVIDER = {
  a: 'provider-a.example',
  b: 'provider-b.example',
  c: 'provider-c.example',
  own: 'self-hosted',
} as const;

export const HOSTILE_MODEL = `L${'ก'.repeat(2000)}${'ش'.repeat(2000)}${'x'.repeat(999)}`;

const ADMIN = { id: '1001', username: 'root' };

const MODELS: MockUsageModel[] = [
  {
    id: MODEL.llmMain,
    resourceType: 'LLM',
    provider: PROVIDER.a,
    model: 'model-large-1',
    syncAdapter: 'DASHSCOPE_INTL',
    syncModelId: 'model-large-1',
    firstSeenAt: '2026-07-01T02:00:00Z',
    lastSeenAt: '2026-10-26T01:00:00Z',
  },
  {
    id: MODEL.llmArabic,
    resourceType: 'LLM',
    provider: PROVIDER.a,
    model: 'نموذج-كبير-٢',
    syncAdapter: null,
    syncModelId: 'نموذج-كبير-٢',
    firstSeenAt: '2026-08-10T02:00:00Z',
    lastSeenAt: '2026-10-25T23:00:00Z',
  },
  {
    id: MODEL.llmThai,
    resourceType: 'LLM',
    provider: PROVIDER.a,
    model: 'โมเดลภาษาไทยใหม่',
    syncAdapter: 'DASHSCOPE_INTL',
    syncModelId: 'โมเดลภาษาไทยใหม่',
    firstSeenAt: '2026-10-20T02:00:00Z',
    lastSeenAt: '2026-10-26T00:30:00Z',
  },
  {
    id: MODEL.imageEdit,
    resourceType: 'IMAGE_EDIT',
    provider: PROVIDER.b,
    model: 'modelo-imagen-grande-😀',
    syncAdapter: null,
    syncModelId: 'modelo-imagen-grande-😀',
    firstSeenAt: '2026-09-01T02:00:00Z',
    lastSeenAt: '2026-10-26T00:00:00Z',
  },
  {
    id: MODEL.video,
    resourceType: 'IMAGE_TO_VIDEO',
    provider: PROVIDER.b,
    model: 'mô-hình-video-lớn',
    syncAdapter: null,
    syncModelId: 'mô-hình-video-lớn',
    firstSeenAt: '2026-09-02T02:00:00Z',
    lastSeenAt: '2026-10-25T20:00:00Z',
  },
  {
    id: MODEL.matting,
    resourceType: 'MATTING',
    provider: PROVIDER.own,
    model: 'matting-model-besar',
    syncAdapter: null,
    syncModelId: 'matting-model-besar',
    firstSeenAt: '2026-10-05T02:00:00Z',
    lastSeenAt: '2026-10-26T01:10:00Z',
  },
  {
    id: MODEL.cloudRender,
    resourceType: 'CLOUD_RENDER',
    provider: PROVIDER.own,
    model: '云端渲染模型',
    syncAdapter: null,
    syncModelId: '云端渲染模型',
    firstSeenAt: '2026-10-01T02:00:00Z',
    lastSeenAt: '2026-10-25T22:00:00Z',
  },
  {
    id: MODEL.llmHostile,
    resourceType: 'LLM',
    provider: PROVIDER.c,
    model: HOSTILE_MODEL,
    syncAdapter: null,
    syncModelId: HOSTILE_MODEL,
    firstSeenAt: '2026-10-12T02:00:00Z',
    lastSeenAt: '2026-10-24T02:00:00Z',
  },
  {
    id: MODEL.drivingPrep,
    resourceType: 'DRIVING_PREP',
    provider: PROVIDER.own,
    model: 'driving-prep-1',
    syncAdapter: null,
    syncModelId: 'driving-prep-1',
    firstSeenAt: '2026-10-06T02:00:00Z',
    lastSeenAt: '2026-10-26T01:00:00Z',
  },
  {
    id: MODEL.ageEstimation,
    resourceType: 'AGE_ESTIMATION',
    provider: PROVIDER.own,
    model: 'age-estimation-1',
    syncAdapter: null,
    syncModelId: 'age-estimation-1',
    firstSeenAt: '2026-10-06T02:00:00Z',
    lastSeenAt: '2026-10-26T01:00:00Z',
  },
];

const band = (
  min: number,
  max: number | null,
  input: string,
  cached: string | null,
  output: string,
): MockBand => ({
  inputMinTokens: min,
  inputMaxTokens: max,
  inputPrice: input,
  cachedInputPrice: cached,
  outputPrice: output,
});

type Seed = Partial<MockBatch> &
  Pick<MockBatch, 'batchId' | 'resourceType' | 'provider' | 'model' | 'effectiveFrom' | 'status'>;

const UNITS: Record<string, string> = {
  LLM: 'TOKENS_1M',
  IMAGE_EDIT: 'CALL',
  IMAGE_TO_VIDEO: 'SECOND',
  MATTING: 'CALL',
  DRIVING_PREP: 'CALL',
  AGE_ESTIMATION: 'CALL',
  CLOUD_RENDER: 'MINUTE',
};

function batch(seed: Seed): MockBatch {
  const manual = seed.source === 'MANUAL';
  const reviewed = seed.status === 'REJECTED' || seed.status === 'RETIRED';
  return {
    unit: UNITS[seed.resourceType],
    currency: 'USD',
    source: 'SYNC',
    confirmedBy: seed.status === 'ACTIVE' || seed.status === 'SUPERSEDED' ? ADMIN.id : null,
    confirmedByUsername:
      seed.status === 'ACTIVE' || seed.status === 'SUPERSEDED' ? ADMIN.username : null,
    confirmedAt:
      seed.status === 'ACTIVE' || seed.status === 'SUPERSEDED'
        ? `${seed.effectiveFrom}T03:00:00Z`
        : null,
    reviewedBy: reviewed ? '1002' : null,
    reviewedByUsername: reviewed ? 'support' : null,
    reviewedAt: reviewed ? '2026-10-02T03:00:00Z' : null,
    reviewNote: null,
    createdAt: manual ? `${seed.effectiveFrom}T02:00:00Z` : '2026-10-01T02:00:00Z',
    bands: null,
    unitPrice: null,
    ...seed,
  };
}

function sampleBatches(): MockBatch[] {
  const m = (id: string) => MODELS.find((x) => x.id === id) as MockUsageModel;
  const main = m(MODEL.llmMain);
  const arabic = m(MODEL.llmArabic);
  const thai = m(MODEL.llmThai);
  const image = m(MODEL.imageEdit);
  const video = m(MODEL.video);
  const render = m(MODEL.cloudRender);
  const hostile = m(MODEL.llmHostile);
  const age = m(MODEL.ageEstimation);
  const of = (model: MockUsageModel) => ({
    resourceType: model.resourceType,
    provider: model.provider,
    model: model.model,
  });
  return [
    batch({
      batchId: BATCH.activeLlm,
      ...of(main),
      effectiveFrom: '2026-09-01',
      status: 'ACTIVE',
      source: 'MANUAL',
      bands: [
        band(0, 32000, '0.4000000000', '0.0800000000', '1.2000000000'),
        band(32001, null, '1.0000000000', '0.2000000000', '3.0000000000'),
      ],
    }),
    batch({
      batchId: BATCH.supersededLlm,
      ...of(main),
      effectiveFrom: '2026-08-01',
      status: 'SUPERSEDED',
      source: 'MANUAL',
      bands: [band(0, null, '0.5000000000', null, '1.5000000000')],
    }),
    batch({
      batchId: BATCH.rejectedLlm,
      ...of(main),
      effectiveFrom: '2026-09-20',
      status: 'REJECTED',
      reviewNote: 'ราคาสูงเกินไป too high 价格过高',
      bands: [band(0, null, '2.0000000000', '1.0000000000', '6.0000000000')],
    }),
    batch({
      batchId: BATCH.retiredLlm,
      ...of(main),
      effectiveFrom: '2026-07-01',
      status: 'RETIRED',
      source: 'MANUAL',
      reviewNote: 'Entered for the wrong model',
      bands: [band(0, null, '0.1000000000', null, '0.3000000000')],
    }),
    batch({
      batchId: BATCH.pendingLlm,
      ...of(main),
      effectiveFrom: '2026-10-26',
      status: 'PENDING_REVIEW',
      bands: [
        band(0, 32000, '0.3000000000', '0.0600000000', '1.0000000000'),
        band(32001, 128000, '0.8000000000', '0.1600000000', '2.4000000000'),
        band(128001, null, '1.5000000000', '0.3000000000', '4.5000000000'),
      ],
    }),
    batch({
      batchId: BATCH.activeArabic,
      ...of(arabic),
      effectiveFrom: '2026-08-15',
      status: 'ACTIVE',
      source: 'MANUAL',
      bands: [band(0, null, '0.0000000001', null, '0.0000000002')],
    }),
    batch({
      batchId: BATCH.pendingGap,
      ...of(arabic),
      effectiveFrom: '2026-10-26',
      status: 'PENDING_REVIEW',
      bands: [
        band(0, 1000, '0.0000000003', null, '0.0000000004'),
        band(2000, null, '0.0000000005', null, '0.0000000006'),
      ],
    }),
    batch({
      batchId: BATCH.rejectedThai,
      ...of(thai),
      effectiveFrom: '2026-10-21',
      status: 'REJECTED',
      reviewNote: 'الحدود غير صحيحة',
      bands: [band(0, null, '9.0000000000', null, '9.0000000000')],
    }),
    batch({
      batchId: BATCH.pendingNoActive,
      ...of(thai),
      effectiveFrom: '2026-10-26',
      status: 'PENDING_REVIEW',
      bands: [band(0, null, '0.5000000000', '0.1000000000', '1.5000000000')],
    }),
    batch({
      batchId: BATCH.activeImage,
      ...of(image),
      effectiveFrom: '2026-09-10',
      status: 'ACTIVE',
      source: 'MANUAL',
      unitPrice: '0.0400000000',
    }),
    batch({
      batchId: BATCH.pendingImage,
      ...of(image),
      effectiveFrom: '2026-10-26',
      status: 'PENDING_REVIEW',
      unitPrice: '0.0450000000',
    }),
    batch({
      batchId: BATCH.activeVideo,
      ...of(video),
      effectiveFrom: '2026-09-11',
      status: 'ACTIVE',
      source: 'MANUAL',
      unitPrice: '0.1000000000',
    }),
    batch({
      batchId: BATCH.futureVideo,
      ...of(video),
      effectiveFrom: '2099-01-01',
      status: 'ACTIVE',
      source: 'MANUAL',
      unitPrice: '0.0900000000',
    }),
    batch({
      batchId: BATCH.activeRender,
      ...of(render),
      effectiveFrom: '2026-10-02',
      status: 'ACTIVE',
      source: 'MANUAL',
      unitPrice: '0',
    }),
    batch({
      batchId: BATCH.activeHostile,
      ...of(hostile),
      effectiveFrom: '2026-10-12',
      status: 'ACTIVE',
      source: 'MANUAL',
      bands: [band(0, null, '1', '0.5', '2')],
    }),
    batch({
      batchId: BATCH.activeAge,
      ...of(age),
      effectiveFrom: '2026-10-06',
      status: 'ACTIVE',
      source: 'MANUAL',
      unitPrice: '0.0010000000',
    }),
  ];
}

const holder = globalThis as { __avatarAdminMockCost?: CostStore };
holder.__avatarAdminMockCost ??= {
  batches: sampleBatches(),
  models: structuredClone(MODELS),
  next: 1,
};
export const costState: CostStore = holder.__avatarAdminMockCost;

/** Puts the sample data back (for a test). */
export function resetCostStore(): void {
  costState.batches = sampleBatches();
  costState.models = structuredClone(MODELS);
  costState.next = 1;
}

export const newBatchId = (): string => `bt-new-${costState.next++}`;

export const todayUtc = (): string => new Date().toISOString().slice(0, 10);

/** The key a price is looked up by (contract 14.2): resource type, provider, model, unit. */
export const modelKey = (
  b: Pick<MockBatch, 'resourceType' | 'provider' | 'model' | 'unit'>,
): string => [b.resourceType, b.provider, b.model, b.unit].join('\u0000');

/** The batch in force today for a model: the `ACTIVE` one whose date has come and is the latest. */
export function activeToday(key: string, today = todayUtc()): MockBatch | null {
  const rows = costState.batches
    .filter((b) => b.status === 'ACTIVE' && b.effectiveFrom <= today && modelKey(b) === key)
    .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1));
  return rows[0] ?? null;
}

export function hasActivePrice(model: MockUsageModel): boolean {
  return costState.batches.some(
    (b) =>
      b.status === 'ACTIVE' &&
      b.effectiveFrom <= todayUtc() &&
      b.resourceType === model.resourceType &&
      b.provider === model.provider &&
      b.model === model.model,
  );
}

export const adminOfBatch = ADMIN;
