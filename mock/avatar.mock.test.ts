import { beforeEach, describe, expect, it } from 'vitest';
import {
  ACCOUNT,
  avatarState,
  GENERATION_MS,
  resetAvatarStore,
  settleGenerations,
} from './_core/avatarData';
import { issueToken, resetStore } from './_core/store';
import { adminOf, bearer, call } from './_core/testing';
import avatar from './avatar.mock';

beforeEach(() => {
  resetStore();
  resetAvatarStore();
});

type H = Parameters<typeof call>[0];
const h = (name: string) => (avatar as unknown as Record<string, H>)[name];
const token = (user: string) => bearer(issueToken(adminOf(user)).token).authorization;

const get = (name: string, user = 'root', query: Record<string, unknown> = {}, params = {}) =>
  call(h(name), { headers: { authorization: token(user) }, query, params });
const send = (name: string, body: unknown, params = {}, user = 'root') =>
  call(h(name), { headers: { authorization: token(user) }, body, params });

const COSMETICS = 'GET /api/admin/cosmetics';
const COSMETIC_CREATE = 'POST /api/admin/cosmetics';
const COSMETIC_UPDATE = 'PUT /api/admin/cosmetics/:id';
const COSMETIC_ENABLED = 'PUT /api/admin/cosmetics/:id/enabled';
const ACTIONS = 'GET /api/admin/actions';
const ACTION_CREATE = 'POST /api/admin/actions';
const BACKFILL = 'POST /api/admin/actions/:id/backfill';
const UPLOAD_IMAGE = 'POST /api/admin/uploads/catalog-image';
const UPLOAD_MODEL = 'POST /api/admin/uploads/renderer-model';
const UPLOAD_SOURCE = 'POST /api/admin/uploads/default-avatar-source';
const DECLARATIONS = 'GET /api/admin/declarations';
const DECLARATION_CREATE = 'POST /api/admin/declarations';
const ACTIVATE_DECLARATION = 'PUT /api/admin/declarations/:version/activate';
const MODELS = 'GET /api/admin/renderer-models';
const MODEL_CREATE = 'POST /api/admin/renderer-models';
const TASKS = 'GET /api/admin/generation-tasks';
const DEFAULTS = 'GET /api/admin/default-avatars';
const DEFAULT_CREATE = 'POST /api/admin/default-avatars';
const DEFAULT_RENAME = 'PUT /api/admin/default-avatars/:id';
const GENERATE = 'POST /api/admin/default-avatars/:id/generate';
const ACTIVATE = 'POST /api/admin/default-avatars/:id/activate';
const REMOVE = 'DELETE /api/admin/default-avatars/:id';
const ACCOUNT_AVATARS = 'GET /api/admin/accounts/:id/avatars';
const GRANT = 'POST /api/admin/accounts/:id/cosmetics';

const upload = async (name: string) => (await send(name, undefined)).body.data.uploadId as string;

const cosmeticBody = (over: Record<string, unknown> = {}) => ({
  key: 'outfit_new',
  kind: 'OUTFIT',
  names: { en: 'New' },
  generationSpec: 'a green coat',
  compatibleStyles: ['STYLIZED_3D'],
  surfaces: [],
  creditPrice: null,
  isFree: false,
  isDefault: false,
  sortOrder: 5,
  ...over,
});

describe('permissions (contract 17.4, the 形象与装扮 row)', () => {
  const cases: [string, string][] = [
    [COSMETICS, 'COSMETIC:MANAGE or COSMETIC:GRANT'],
    [ACTIONS, 'ACTION:MANAGE'],
    [DECLARATIONS, 'DECLARATION:MANAGE'],
    [MODELS, 'RENDERER:MANAGE'],
    [TASKS, 'GENERATION:VIEW'],
    [DEFAULTS, 'DEFAULT_AVATAR:MANAGE'],
    [UPLOAD_IMAGE, 'COSMETIC:MANAGE or ACTION:MANAGE'],
    [UPLOAD_MODEL, 'RENDERER:MANAGE'],
    [UPLOAD_SOURCE, 'DEFAULT_AVATAR:MANAGE'],
  ];
  it.each(cases)('%s answers 403 ADMIN_FORBIDDEN for an administrator without %s', async (name) => {
    const { status, body } = await get(name, 'finance');
    expect(status).toBe(403);
    expect(body.code).toBe('ADMIN_FORBIDDEN');
  });

  it('answers 401 without a token on every endpoint but the files', async () => {
    for (const name of Object.keys(avatar)) {
      if (name.includes('mock-files')) continue;
      const { status } = await call(h(name), { params: { id: '1' } });
      expect(status, name).toBe(401);
    }
  });

  it('opens the cosmetic list to COSMETIC:GRANT but not the writes', async () => {
    const adminGrant = adminOf('support');
    adminGrant.permissions = ['COSMETIC:GRANT'];
    expect((await get(COSMETICS, 'support')).status).toBe(200);
    expect((await send(COSMETIC_CREATE, cosmeticBody(), {}, 'support')).status).toBe(403);
    expect((await send(COSMETIC_ENABLED, { enabled: false }, { id: '3' }, 'support')).status).toBe(
      403,
    );
  });

  it('lets only USER:VIEW read the avatars of an account and only COSMETIC:GRANT grant', async () => {
    expect((await get(ACCOUNT_AVATARS, 'finance', {}, { id: ACCOUNT.rich })).status).toBe(403);
    expect((await get(ACCOUNT_AVATARS, 'support', {}, { id: ACCOUNT.rich })).status).toBe(200);
    expect(
      (await send(GRANT, { itemId: '4', reason: 'x' }, { id: ACCOUNT.empty }, 'support')).status,
    ).toBe(403);
  });
});

describe('uploads and the cosmetic catalog', () => {
  it('hands out an uploadId for each of the three entries', async () => {
    for (const name of [UPLOAD_IMAGE, UPLOAD_MODEL, UPLOAD_SOURCE]) {
      expect(await upload(name)).toMatch(/^upl-/);
    }
  });

  it('lists with the filters, in the order of sortOrder, with an address per preview that changes each time', async () => {
    const first = await get(COSMETICS, 'root', { pageSize: '200' });
    const all = first.body.data.items;
    expect(first.body.data.total).toBe(avatarState.cosmetics.length);
    expect(all.map((c: { sortOrder: number }) => c.sortOrder)).toEqual(
      [...all.map((c: { sortOrder: number }) => c.sortOrder)].sort((a, b) => a - b),
    );
    const second = await get(COSMETICS, 'root', { pageSize: '200' });
    expect(second.body.data.items[0].previewUrl).not.toBe(all[0].previewUrl);
    expect(all.find((c: { key: string }) => c.key === 'bg_night_city').previewUrl).toBeNull();
    expect('previewRef' in all[0]).toBe(false);

    const outfits = await get(COSMETICS, 'root', { kind: 'OUTFIT', pageSize: '200' });
    expect(outfits.body.data.items.every((c: { kind: string }) => c.kind === 'OUTFIT')).toBe(true);
    const off = await get(COSMETICS, 'root', { enabled: 'false', pageSize: '200' });
    expect(off.body.data.items.map((c: { key: string }) => c.key)).toContain('bg_night_city');
    expect(off.body.data.items.every((c: { enabled: boolean }) => !c.enabled)).toBe(true);
    const real = await get(COSMETICS, 'root', { style: 'REALISTIC', pageSize: '200' });
    expect(
      real.body.data.items.every((c: { compatibleStyles: string[] }) =>
        c.compatibleStyles.includes('REALISTIC'),
      ),
    ).toBe(true);
    expect((await get(COSMETICS, 'root', { kind: 'HAT' })).status).toBe(400);
    expect((await get(COSMETICS, 'root', { pageSize: '0' })).body.data.details[0].ref).toBe(
      'pageSize',
    );
  });

  it('creates an item with the picture named by its uploadId and keeps the key', async () => {
    const previewUploadId = await upload(UPLOAD_IMAGE);
    const created = await send(
      COSMETIC_CREATE,
      cosmeticBody({ previewUploadId, key: ' new_key ' }),
    );
    expect(created.status).toBe(200);
    expect(created.body.data.key).toBe('new_key');
    expect(created.body.data.enabled).toBe(false);
    expect(created.body.data.previewUrl).toContain('/api/admin/mock-files/');
    const again = await send(
      COSMETIC_CREATE,
      cosmeticBody({ previewUploadId: await upload(UPLOAD_IMAGE), key: 'new_key' }),
    );
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('DUPLICATE_RESOURCE');
    expect(again.body.data.field).toBe('key');
  });

  it('refuses an upload id that is missing, unknown, of another kind, or used already', async () => {
    const missing = await send(COSMETIC_CREATE, cosmeticBody());
    expect(missing.status).toBe(400);
    expect(missing.body.data.details).toEqual([
      { ref: 'previewUploadId', reason: 'EMPTY_NOT_ALLOWED' },
    ]);
    expect((await send(COSMETIC_CREATE, cosmeticBody({ previewUploadId: 'nope' }))).status).toBe(
      404,
    );
    const wrong = await send(
      COSMETIC_CREATE,
      cosmeticBody({ previewUploadId: await upload(UPLOAD_MODEL) }),
    );
    expect(wrong.status).toBe(400);
    expect(wrong.body.code).toBe('INVALID_REQUEST');
    const id = await upload(UPLOAD_IMAGE);
    expect((await send(COSMETIC_CREATE, cosmeticBody({ previewUploadId: id }))).status).toBe(200);
    const used = await send(COSMETIC_CREATE, cosmeticBody({ previewUploadId: id, key: 'other' }));
    expect(used.status).toBe(409);
    expect(used.body.code).toBe('INVALID_STATE');
  });

  it('checks the generation text in code points after trimming: Arabic and emoji count one each', async () => {
    const make = (generationSpec: string) =>
      send(COSMETIC_UPDATE, cosmeticBody({ generationSpec }), { id: '3' });
    expect((await make('')).body.data.details).toEqual([
      { ref: 'generationSpec', reason: 'EMPTY_NOT_ALLOWED' },
    ]);
    expect((await make(String.fromCharCode(0x3000, 0x20, 0xa0))).status).toBe(400);
    expect((await make('😀'.repeat(2000))).status).toBe(200);
    const long = await make('ب'.repeat(2001));
    expect(long.body.data.details).toEqual([{ ref: 'generationSpec', reason: 'TOO_LONG' }]);
  });

  it('updates by id without touching the key, clears the price with null, and answers 404 for an unknown id', async () => {
    const before = avatarState.cosmetics.find((c) => c.id === '3');
    const updated = await send(
      COSMETIC_UPDATE,
      cosmeticBody({ key: 'ignored', creditPrice: null }),
      { id: '3' },
    );
    expect(updated.body.data.key).toBe(before?.key);
    expect(updated.body.data.creditPrice).toBeNull();
    expect((await send(COSMETIC_UPDATE, cosmeticBody(), { id: 'zz' })).status).toBe(404);
  });

  it('switches an item on and off, and the default of a kind moves to the item that is made the default', async () => {
    const off = await send(COSMETIC_ENABLED, { enabled: false }, { id: '3' });
    expect(off.body.data.enabled).toBe(false);
    expect((await send(COSMETIC_ENABLED, { enabled: 'yes' }, { id: '3' })).status).toBe(400);
    await send(COSMETIC_UPDATE, cosmeticBody({ isFree: true, isDefault: true }), { id: '3' });
    const defaults = avatarState.cosmetics.filter((c) => c.kind === 'OUTFIT' && c.isDefault);
    expect(defaults.map((c) => c.id)).toEqual(['3']);
  });

  it('refuses a default that is not free, a surface of a platform that does not exist, and a price that is not whole', async () => {
    const bad = await send(
      COSMETIC_UPDATE,
      cosmeticBody({
        isDefault: true,
        isFree: false,
        surfaces: [{ platform: 'WEB', channel: null }],
        creditPrice: 1.5,
      }),
      { id: '3' },
    );
    expect(bad.status).toBe(400);
    expect(bad.body.data.details.map((d: { ref: string }) => d.ref).sort()).toEqual(
      ['creditPrice', 'isDefault', 'surfaces'].sort(),
    );
  });
});

describe('actions', () => {
  it('lists, creates with iconUploadId and starts the new action disabled', async () => {
    expect((await get(ACTIONS)).body.data.total).toBe(avatarState.actions.length);
    const body = {
      key: 'spin',
      names: { en: 'Spin' },
      description: 'Spins once',
      generationSpec: 'The person turns around once.',
      compatibleStyles: ['STYLIZED_3D'],
      surfaces: [{ platform: 'IOS', channel: null }],
      triggerableBy: 'AGENT',
      sortOrder: 70,
    };
    expect((await send(ACTION_CREATE, body)).status).toBe(400);
    const created = await send(ACTION_CREATE, {
      ...body,
      iconUploadId: await upload(UPLOAD_IMAGE),
    });
    expect(created.status).toBe(200);
    expect(created.body.data.enabled).toBe(false);
    expect('type' in created.body.data).toBe(false);
    expect(created.body.data.iconUrl).toContain('mock-files');
    expect(
      (await send(ACTION_CREATE, { ...body, iconUploadId: await upload(UPLOAD_IMAGE) })).status,
    ).toBe(409);
  });

  it('takes all three values of triggerableBy and refuses another', async () => {
    for (const [n, triggerableBy] of ['USER', 'AGENT', 'BOTH'].entries()) {
      const r = await send(
        'PUT /api/admin/actions/:id',
        {
          names: { en: 'A' },
          description: 'd',
          generationSpec: 's',
          compatibleStyles: ['REALISTIC'],
          surfaces: [],
          triggerableBy,
          sortOrder: n,
        },
        { id: '1' },
      );
      expect(r.status).toBe(200);
      expect(r.body.data.triggerableBy).toBe(triggerableBy);
    }
    const bad = await send(
      'PUT /api/admin/actions/:id',
      {
        names: { en: 'A' },
        description: 'd',
        generationSpec: 's',
        compatibleStyles: [],
        surfaces: [],
        triggerableBy: 'ROBOT',
        sortOrder: 0,
      },
      { id: '1' },
    );
    expect(bad.body.data.details).toEqual([{ ref: 'triggerableBy', reason: 'OUT_OF_RANGE' }]);
  });

  it('backfills: answers how many were queued, then nothing is left; 404 for an unknown action and 409 for a disabled one', async () => {
    const first = await send(BACKFILL, undefined, { id: '1' });
    expect(first.body.data).toEqual({ scheduled: 7 });
    expect((await send(BACKFILL, undefined, { id: '1' })).body.data).toEqual({ scheduled: 0 });
    expect((await send(BACKFILL, undefined, { id: 'zz' })).status).toBe(404);
    const disabled = await send(BACKFILL, undefined, { id: '5' });
    expect(disabled.status).toBe(409);
    expect(disabled.body.code).toBe('INVALID_STATE');
  });
});

describe('declarations', () => {
  it('lists the versions, creates one that is not active, and makes exactly one active', async () => {
    const listed = await get(DECLARATIONS);
    expect(listed.body.data.items.filter((d: { isActive: boolean }) => d.isActive)).toHaveLength(1);
    const created = await send(DECLARATION_CREATE, {
      version: '2027-v1',
      texts: { en: 'Agree', th: 'ยอมรับ' },
    });
    expect(created.body.data).toMatchObject({
      version: '2027-v1',
      isActive: false,
      activeFrom: null,
    });
    expect(
      (await send(DECLARATION_CREATE, { version: '2027-v1', texts: { en: 'x' } })).status,
    ).toBe(409);
    expect(
      (await send(DECLARATION_CREATE, { version: ' ', texts: {} })).body.data.details,
    ).toHaveLength(2);
    const activated = await send(ACTIVATE_DECLARATION, undefined, { version: '2027-v1' });
    expect(activated.body.data.isActive).toBe(true);
    expect(avatarState.declarations.filter((d) => d.isActive).map((d) => d.version)).toEqual([
      '2027-v1',
    ]);
    expect((await send(ACTIVATE_DECLARATION, undefined, { version: 'nope' })).status).toBe(404);
  });
});

describe('renderer models', () => {
  const model = (uploadId: string, over: Record<string, unknown> = {}) => ({
    uploadId,
    rendererKind: 'AVATAR_RENDERER_V1',
    version: '1.1.0',
    platform: 'ANDROID',
    abi: 'x86_64',
    rendererFormatVersion: 1,
    minVersionCode: 120,
    ...over,
  });

  it("registers a model from its upload: size and digest are the upload record's, whatever the request says", async () => {
    const uploadId = await upload(UPLOAD_MODEL);
    const created = await send(MODEL_CREATE, model(uploadId, { sha256: 'fake', sizeBytes: 1 }));
    expect(created.status).toBe(200);
    expect(created.body.data.sha256).toBe(avatarState.uploads.get(uploadId)?.sha256);
    expect(created.body.data.sizeBytes).toBe(47_185_920);
    expect(created.body.data.enabled).toBe(false);
    const dup = await send(MODEL_CREATE, model(await upload(UPLOAD_MODEL)));
    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe('DUPLICATE_RESOURCE');
    expect((await send(MODEL_CREATE, model(await upload(UPLOAD_IMAGE), { abi: 'a' }))).status).toBe(
      400,
    );
    const invalid = await send(
      MODEL_CREATE,
      model(await upload(UPLOAD_MODEL), { platform: 'PC', rendererFormatVersion: 0 }),
    );
    expect(invalid.body.data.details.map((d: { ref: string }) => d.ref).sort()).toEqual(
      ['platform', 'rendererFormatVersion'].sort(),
    );
  });

  it('lists and switches', async () => {
    expect((await get(MODELS)).body.data.total).toBe(3);
    const on = await send(
      'PUT /api/admin/renderer-models/:id/enabled',
      { enabled: true },
      { id: '3' },
    );
    expect(on.body.data.enabled).toBe(true);
    expect(
      (await send('PUT /api/admin/renderer-models/:id/enabled', { enabled: true }, { id: '99' }))
        .status,
    ).toBe(404);
  });
});

describe('generation tasks', () => {
  it('filters by status and type, newest first, with the system tasks that have no account', async () => {
    const failed = await get(TASKS, 'root', { status: 'FAILED', pageSize: '200' });
    expect(failed.body.data.items.every((t: { status: string }) => t.status === 'FAILED')).toBe(
      true,
    );
    expect(
      failed.body.data.items.some((t: { accountId: string | null }) => t.accountId === null),
    ).toBe(true);
    const clips = await get(TASKS, 'root', {
      status: 'FAILED',
      type: 'ACTION_CLIP',
      pageSize: '200',
    });
    expect(clips.body.data.items.length).toBeGreaterThan(0);
    expect(clips.body.data.items.every((t: { type: string }) => t.type === 'ACTION_CLIP')).toBe(
      true,
    );
    expect((await get(TASKS, 'root', { type: 'TALK' })).status).toBe(400);
  });
});

describe('default avatars', () => {
  const create = async (over: Record<string, unknown> = {}) =>
    send(DEFAULT_CREATE, {
      name: ' Vega ',
      style: 'STYLIZED_3D',
      sourceUploadId: await upload(UPLOAD_SOURCE),
      ...over,
    });

  it('lists newest first with status, failure reason and the two addresses, and no storage reference', async () => {
    const { body } = await get(DEFAULTS);
    expect(body.data.items).toHaveLength(5);
    expect(Object.keys(body.data.items[0]).sort()).toEqual(
      [
        'failureReason',
        'id',
        'isActive',
        'lookId',
        'name',
        'previewUrl',
        'sourceImageUrl',
        'status',
        'style',
      ].sort(),
    );
    const draft = body.data.items.find((d: { failureReason: string | null }) => d.failureReason);
    expect(draft).toMatchObject({ status: 'DRAFT', failureReason: 'SUBJECT_UNDERAGE' });
  });

  it('creates a draft from the uploaded source and ignores portraitAuthorized', async () => {
    const created = await create({ portraitAuthorized: true });
    expect(created.status).toBe(200);
    expect(created.body.data).toMatchObject({
      name: 'Vega',
      status: 'DRAFT',
      isActive: false,
      failureReason: null,
    });
    expect(created.body.data.sourceImageUrl).toContain('mock-files');
    expect(created.body.data.previewUrl).toBeNull();
  });

  it('applies the name rule: empty, over 30 code points, control characters, bidirectional overrides', async () => {
    const reason = async (name: string) => (await create({ name })).body.data?.details?.[0];
    expect(await reason('  ')).toEqual({ ref: 'name', reason: 'EMPTY_NOT_ALLOWED' });
    expect(await reason('x'.repeat(31))).toEqual({ ref: 'name', reason: 'TOO_LONG' });
    expect(await reason('a\u0007b')).toEqual({ ref: 'name', reason: 'OUT_OF_RANGE' });
    expect(await reason(`a${String.fromCharCode(0x202e)}b`)).toEqual({
      ref: 'name',
      reason: 'OUT_OF_RANGE',
    });
    expect((await create({ name: '😀'.repeat(30) })).status).toBe(200);
    expect((await create({ name: 'ب'.repeat(30) })).status).toBe(200);
    expect((await create({ style: 'CARTOON' })).body.data.details[0].ref).toBe('style');
  });

  it('renames with {name} only and applies the same rule', async () => {
    const renamed = await send(DEFAULT_RENAME, { name: ' Nova ' }, { id: 'da-4' });
    expect(renamed.body.data.name).toBe('Nova');
    expect((await send(DEFAULT_RENAME, { name: '' }, { id: 'da-4' })).status).toBe(400);
    expect((await send(DEFAULT_RENAME, { name: 'x' }, { id: 'zz' })).status).toBe(404);
  });

  it('generates only a draft: the failure reason goes away, the state is GENERATING, then READY after the generation time', async () => {
    const generated = await send(GENERATE, undefined, { id: 'da-3' });
    expect(generated.body.data).toMatchObject({ status: 'GENERATING', failureReason: null });
    const again = await send(GENERATE, undefined, { id: 'da-3' });
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('INVALID_STATE');
    expect(again.body.data.status).toBe('GENERATING');
    expect((await send(GENERATE, undefined, { id: 'da-4' })).body.data.status).toBe('READY');
    settleGenerations(Date.now() + GENERATION_MS + 1);
    const row = avatarState.defaultAvatars.find((d) => d.id === 'da-3');
    expect(row).toMatchObject({ status: 'READY', failureReason: null });
    expect(row?.previewFile).not.toBeNull();
  });

  it('puts a failed generation back to DRAFT with a reason (there is no FAILED state)', async () => {
    const created = await create({ name: 'will fail' });
    const id = created.body.data.id;
    await send(GENERATE, undefined, { id });
    settleGenerations(Date.now() + GENERATION_MS + 1);
    const row = avatarState.defaultAvatars.find((d) => d.id === id);
    expect(row).toMatchObject({ status: 'DRAFT', failureReason: 'GENERATION_FAILED' });
  });

  it('answers 503 GENERATION_NOT_CONFIGURED when the generation is not configured, and leaves the draft', async () => {
    avatarState.generationConfigured = false;
    const r = await send(GENERATE, undefined, { id: 'da-3' });
    expect(r.status).toBe(503);
    expect(r.body.code).toBe('GENERATION_NOT_CONFIGURED');
    expect(avatarState.defaultAvatars.find((d) => d.id === 'da-3')?.status).toBe('DRAFT');
  });

  it('activates only a READY avatar, one at a time: the earlier one stays but is no longer active', async () => {
    const refused = await send(ACTIVATE, undefined, { id: 'da-3' });
    expect(refused.status).toBe(409);
    expect(refused.body.data.status).toBe('DRAFT');
    const ok = await send(ACTIVATE, undefined, { id: 'da-4' });
    expect(ok.body.data.isActive).toBe(true);
    expect(avatarState.defaultAvatars.filter((d) => d.isActive).map((d) => d.id)).toEqual(['da-4']);
    expect(avatarState.defaultAvatars.some((d) => d.id === 'da-5')).toBe(true);
  });

  it('deletes only an avatar that is neither active nor generating', async () => {
    const active = await send(REMOVE, undefined, { id: 'da-5' });
    expect(active.status).toBe(409);
    expect(active.body.data.status).toBe('READY');
    const running = await send(REMOVE, undefined, { id: 'da-2' });
    expect(running.status).toBe(409);
    expect(running.body.data.status).toBe('GENERATING');
    expect((await send(REMOVE, undefined, { id: 'da-3' })).status).toBe(200);
    expect(avatarState.defaultAvatars.some((d) => d.id === 'da-3')).toBe(false);
    expect((await send(REMOVE, undefined, { id: 'da-3' })).status).toBe(404);
  });
});

describe("an account's avatars and the grant of a cosmetic", () => {
  it('reads avatars with their looks, the cosmetics with their source, and a new address for each preview on each call', async () => {
    const first = await get(ACCOUNT_AVATARS, 'root', {}, { id: ACCOUNT.rich });
    const { avatars, cosmetics } = first.body.data;
    expect(avatars).toHaveLength(2);
    expect(avatars[0].createdAt >= avatars[1].createdAt).toBe(true);
    expect(avatars[0].looks[0].previewUrl).toContain('mock-files');
    expect(avatars[0].looks[1].previewUrl).toBeNull();
    expect(cosmetics.map((c: { source: string }) => c.source)).toEqual(['CREDITS', 'ADMIN_GRANT']);
    const second = await get(ACCOUNT_AVATARS, 'root', {}, { id: ACCOUNT.rich });
    expect(second.body.data.avatars[0].looks[0].previewUrl).not.toBe(
      avatars[0].looks[0].previewUrl,
    );
    expect((await get(ACCOUNT_AVATARS, 'root', {}, { id: ACCOUNT.empty })).body.data).toEqual({
      avatars: [],
      cosmetics: [],
    });
  });

  it('grants a cosmetic with a reason, once, and then the account owns it with source ADMIN_GRANT', async () => {
    const granted = await send(
      GRANT,
      { itemId: '4', reason: ' Compensation ' },
      { id: ACCOUNT.empty },
    );
    expect(granted.status).toBe(200);
    const read = await get(ACCOUNT_AVATARS, 'root', {}, { id: ACCOUNT.empty });
    expect(read.body.data.cosmetics).toMatchObject([{ itemId: '4', source: 'ADMIN_GRANT' }]);
    const twice = await send(GRANT, { itemId: '4', reason: 'again' }, { id: ACCOUNT.empty });
    expect(twice.status).toBe(409);
    expect(twice.body.code).toBe('DUPLICATE_RESOURCE');
    expect((await send(GRANT, { itemId: '999', reason: 'x' }, { id: ACCOUNT.empty })).status).toBe(
      404,
    );
    expect(
      (await send(GRANT, { itemId: '3', reason: '  ' }, { id: ACCOUNT.empty })).body.data.details,
    ).toEqual([{ ref: 'reason', reason: 'EMPTY_NOT_ALLOWED' }]);
  });
});
