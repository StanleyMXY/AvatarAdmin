import { beforeEach, describe, expect, it } from 'vitest';
import type { PermissionCode } from '../src/access/permissionCodes';
import { appVersionsState, type MockVersion, resetAppVersionsStore } from './_core/appVersionsData';
import { channelsState, resetChannelsStore } from './_core/channelsData';
import { issueToken, resetStore } from './_core/store';
import { adminOf, bearer, call } from './_core/testing';
import appVersions from './appVersions.mock';

const NOW = new Date('2026-10-26T10:00:00Z');

beforeEach(() => {
  resetStore();
  resetChannelsStore();
  resetAppVersionsStore(NOW);
});

type H = Parameters<typeof call>[0];
const h = (name: string) => (appVersions as unknown as Record<string, H>)[name];
const tokenOf = (user: string, codes?: PermissionCode[]) => {
  const admin = adminOf(user);
  if (codes) admin.permissions = codes;
  return bearer(issueToken(admin).token).authorization;
};
const LIST = 'GET /api/admin/app-versions';
const ONE = 'GET /api/admin/app-versions/:id';
const CREATE = 'POST /api/admin/app-versions';
const UPDATE = 'PUT /api/admin/app-versions/:id';
const STATUS = 'PUT /api/admin/app-versions/:id/status';
const DELETE = 'DELETE /api/admin/app-versions/:id';
const UPLOAD = 'POST /api/admin/uploads/apk';

const text = (query: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(query).map(([k, v]) => [k, String(v)]));
const list = (query: Record<string, unknown> = {}, user = 'root', codes?: PermissionCode[]) =>
  call(h(LIST), { headers: { authorization: tokenOf(user, codes) }, query: text(query) });
const one = (id: string) =>
  call(h(ONE), { headers: { authorization: tokenOf('root') }, params: { id } });
const create = (body: unknown, codes?: PermissionCode[]) =>
  call(h(CREATE), { headers: { authorization: tokenOf(codes ? 'support' : 'root', codes) }, body });
const update = (id: string, body: unknown, codes?: PermissionCode[]) =>
  call(h(UPDATE), {
    headers: { authorization: tokenOf(codes ? 'support' : 'root', codes) },
    body,
    params: { id },
  });
const status = (id: string, body: unknown, codes?: PermissionCode[]) =>
  call(h(STATUS), {
    headers: { authorization: tokenOf(codes ? 'support' : 'root', codes) },
    body,
    params: { id },
  });
const remove = (id: string, codes?: PermissionCode[]) =>
  call(h(DELETE), {
    headers: { authorization: tokenOf(codes ? 'support' : 'root', codes) },
    params: { id },
  });
const upload = (codes?: PermissionCode[]) =>
  call(h(UPLOAD), { headers: { authorization: tokenOf(codes ? 'support' : 'root', codes) } });

const refs = (answer: { body: { data: { details?: { ref: string }[] } } }) =>
  (answer.body.data.details ?? []).map((d) => d.ref).sort();
const PLAY_URL = 'https://play.google.com/store/apps/details?id=app.example.play';
const versionBy = (channel: string, code: number): MockVersion => {
  const found = [...appVersionsState.versions.values()].find(
    (v) => v.channelCode === channel && v.versionCode === code,
  );
  if (!found) throw new Error(`no version ${channel} ${code}`);
  return found;
};
const activeOf = (channel: string) =>
  [...appVersionsState.versions.values()].find(
    (v) => v.channelCode === channel && v.status === 'ACTIVE',
  );
const STORE_BODY = {
  channelCode: 'play',
  versionName: '1.3.0',
  versionCode: 130,
  minVersionCode: 110,
  changelog: { en: 'Faster calls', th: 'โทรเร็วขึ้น' },
  storeUrl: PLAY_URL,
};

describe('the sample data', () => {
  it('has one active version in each preset channel, drafts and an archived one, in several languages', () => {
    for (const channel of ['play', 'direct', 'appstore']) {
      const mine = [...appVersionsState.versions.values()].filter((v) => v.channelCode === channel);
      expect(
        mine.filter((v) => v.status === 'ACTIVE'),
        channel,
      ).toHaveLength(1);
      expect(
        mine.some((v) => v.status === 'DRAFT'),
        channel,
      ).toBe(true);
      expect(
        mine.some((v) => v.status === 'ARCHIVED'),
        channel,
      ).toBe(true);
    }
    const tags = new Set(
      [...appVersionsState.versions.values()].flatMap((v) => Object.keys(v.changelog)),
    );
    for (const tag of ['en', 'th', 'ar', 'id', 'vi', 'es', 'zh-Hans'])
      expect(tags.has(tag), tag).toBe(true);
    for (const v of appVersionsState.versions.values()) {
      expect(v.minVersionCode).toBeGreaterThanOrEqual(1);
      expect(v.minVersionCode).toBeLessThanOrEqual(v.versionCode);
      expect(v.changelog.en).toBeTruthy();
    }
  });

  it('has a draft of the app store channel that raises the minimum above the active version', () => {
    const active = activeOf('appstore');
    const stronger = [...appVersionsState.versions.values()].find(
      (v) =>
        v.channelCode === 'appstore' &&
        v.status === 'DRAFT' &&
        v.minVersionCode > (active?.versionCode ?? 0),
    );
    expect(stronger).toBeTruthy();
  });
});

describe('GET /app-versions', () => {
  it('lists the active versions first, the rest newest first', async () => {
    const items = (await list({ pageSize: 100 })).body.data.items as MockVersion[];
    const firstOthers = items.findIndex((v) => v.status !== 'ACTIVE');
    expect(items.slice(0, firstOthers).every((v) => v.status === 'ACTIVE')).toBe(true);
    expect(items.slice(firstOthers).every((v) => v.status !== 'ACTIVE')).toBe(true);
    const rest = items.slice(firstOthers).map((v) => v.createdAt);
    expect(rest).toEqual([...rest].sort().reverse());
  });

  it('filters by channel, platform and status, together', async () => {
    const inPlay = (await list({ channelCode: 'play' })).body.data.items as MockVersion[];
    expect(inPlay.length).toBeGreaterThan(0);
    expect(inPlay.every((v) => v.channelCode === 'play')).toBe(true);
    const ios = (await list({ platform: 'IOS' })).body.data.items as MockVersion[];
    expect(ios.every((v) => v.platform === 'IOS')).toBe(true);
    const drafts = (await list({ status: 'DRAFT' })).body.data.items as MockVersion[];
    expect(drafts.every((v) => v.status === 'DRAFT')).toBe(true);
    const both = (await list({ channelCode: 'direct', status: 'ACTIVE' })).body.data
      .items as MockVersion[];
    expect(both).toHaveLength(1);
    expect((await list({ channelCode: 'nothing-here' })).body.data).toEqual({
      items: [],
      total: 0,
    });
  });

  it('refuses a platform or status that is not one of the values, naming the parameter', async () => {
    const a = await list({ status: 'DONE' });
    expect(a.status).toBe(400);
    expect(refs(a)).toEqual(['status']);
    expect(refs(await list({ platform: 'WEB' }))).toEqual(['platform']);
  });

  it('pages with page and pageSize and refuses a bad page', async () => {
    const total = appVersionsState.versions.size;
    const page = (await list({ page: 2, pageSize: 4 })).body.data;
    expect(page.total).toBe(total);
    expect(page.items).toHaveLength(Math.min(4, total - 4));
    expect(refs(await list({ pageSize: 201 }))).toEqual(['pageSize']);
    expect(refs(await list({ page: 0 }))).toEqual(['page']);
  });

  it('shows the file of a DIRECT version and the link of a STORE version, each only for its own kind', async () => {
    const items = (await list({ pageSize: 100 })).body.data.items as MockVersion[];
    for (const v of items) {
      if (v.channelCode === 'direct') {
        expect(v.storeUrl, v.id).toBeNull();
        expect(v.apkUrl, v.id).toMatch(/^https:\/\//);
        expect(v.apkSha256, v.id).toMatch(/^[0-9a-f]{64}$/);
        expect(v.apkSizeBytes, v.id).toBeGreaterThan(0);
        expect(v.apkUploadId, v.id).toBeTruthy();
      } else {
        expect(v.storeUrl, v.id).toMatch(/^https:\/\//);
        expect(v.apkUrl, v.id).toBeNull();
        expect(v.apkSha256, v.id).toBeNull();
        expect(v.apkUploadId, v.id).toBeNull();
      }
    }
  });

  it('gives the name of the administrator beside the id, and null when the administrator is gone', async () => {
    const mine = versionBy('play', 120);
    mine.createdBy = adminOf('root').id;
    const gone = versionBy('play', 100);
    gone.createdBy = 'deleted-admin';
    const items = (await list({ pageSize: 100 })).body.data.items as MockVersion[];
    expect(items.find((v) => v.id === mine.id)?.createdByUsername).toBe('root');
    expect(items.find((v) => v.id === gone.id)?.createdByUsername).toBeNull();
    expect(items.find((v) => v.id === gone.id)?.createdBy).toBe('deleted-admin');
  });

  it('wants APPVERSION:VIEW and a sign-in', async () => {
    expect((await list({}, 'support', ['CHANNEL:MANAGE'])).status).toBe(403);
    expect((await list({}, 'support', ['APPVERSION:VIEW'])).status).toBe(200);
    expect((await call(h(LIST))).status).toBe(401);
  });
});

describe('GET /app-versions/{id}', () => {
  it('reads one version, and answers 404 for one that is not there', async () => {
    const some = [...appVersionsState.versions.values()][0];
    expect((await one(some.id)).body.data.id).toBe(some.id);
    const missing = await one('nope');
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe('RESOURCE_NOT_FOUND');
  });
});

describe('POST /app-versions: a version of a STORE channel', () => {
  it('creates a draft whose answer and list entry show what was sent', async () => {
    const answer = await create(STORE_BODY);
    expect(answer.status).toBe(200);
    expect(answer.body.data).toMatchObject({
      channelCode: 'play',
      platform: 'ANDROID',
      versionName: '1.3.0',
      versionCode: 130,
      minVersionCode: 110,
      status: 'DRAFT',
      storeUrl: PLAY_URL,
      apkUploadId: null,
      activatedAt: null,
      createdByUsername: 'root',
    });
    expect(
      (await list({ status: 'DRAFT', channelCode: 'play' })).body.data.items.map(
        (v: MockVersion) => v.versionCode,
      ),
    ).toContain(130);
  });

  it('wants APPVERSION:MANAGE: viewing or activating is not enough', async () => {
    expect((await create(STORE_BODY, ['APPVERSION:VIEW'])).status).toBe(403);
    expect((await create(STORE_BODY, ['APPVERSION:ACTIVATE'])).status).toBe(403);
    expect((await create(STORE_BODY, ['APPVERSION:MANAGE'])).status).toBe(200);
  });

  it('checks the version number against the active version of the channel: strictly above', async () => {
    const active = activeOf('play')?.versionCode ?? 0;
    for (const code of [active, active - 1, 0, -2]) {
      const answer = await create({ ...STORE_BODY, versionCode: code, minVersionCode: 1 });
      expect(answer.status, String(code)).toBe(400);
      expect(refs(answer), String(code)).toContain('versionCode');
    }
    expect(refs(await create({ ...STORE_BODY, versionCode: active, minVersionCode: 1 }))).toEqual([
      'versionCode',
    ]);
    expect(
      (await create({ ...STORE_BODY, versionCode: active + 1, minVersionCode: 1 })).status,
    ).toBe(200);
  });

  it('keeps the minimum from 1 to the version number', async () => {
    for (const min of [0, -1, 131, 1.5, null]) {
      const answer = await create({ ...STORE_BODY, minVersionCode: min });
      expect(answer.status, String(min)).toBe(400);
      expect(refs(answer)).toEqual(['minVersionCode']);
    }
    expect((await create({ ...STORE_BODY, minVersionCode: 130 })).status).toBe(200);
  });

  it('wants x.y.z, the notes with en, and a link that fits the platform', async () => {
    expect(refs(await create({ ...STORE_BODY, versionName: '1.3' }))).toEqual(['versionName']);
    expect(refs(await create({ ...STORE_BODY, versionName: 'v1.3.0' }))).toEqual(['versionName']);
    expect(refs(await create({ ...STORE_BODY, changelog: { th: 'x' } }))).toEqual(['changelog']);
    expect(refs(await create({ ...STORE_BODY, changelog: { en: '  ' } }))).toEqual(['changelog']);
    expect(refs(await create({ ...STORE_BODY, changelog: 'text' }))).toEqual(['changelog']);
    expect(refs(await create({ ...STORE_BODY, storeUrl: undefined }))).toEqual(['storeUrl']);
    expect(
      refs(
        await create({
          ...STORE_BODY,
          storeUrl: 'http://play.google.com/store/apps/details?id=app.example.play',
        }),
      ),
    ).toEqual(['storeUrl']);
    expect(
      refs(
        await create({
          ...STORE_BODY,
          storeUrl: 'https://play.google.com/store/apps/details?id=other.app',
        }),
      ),
    ).toEqual(['storeUrl']);
    expect(refs(await create({ ...STORE_BODY, storeUrl: `${PLAY_URL}&referrer=x` }))).toEqual([
      'storeUrl',
    ]);
    expect(
      refs(
        await create({
          ...STORE_BODY,
          channelCode: 'appstore',
          versionCode: 999,
          minVersionCode: 1,
          storeUrl: PLAY_URL,
        }),
      ),
    ).toEqual(['storeUrl']);
    expect(
      (
        await create({
          ...STORE_BODY,
          channelCode: 'appstore',
          versionCode: 999,
          minVersionCode: 1,
          storeUrl: 'https://apps.apple.com/th/app/avatar-chat/id1234567890',
        })
      ).status,
    ).toBe(200);
  });

  it('refuses an upload id for a STORE channel', async () => {
    const up = (await upload()).body.data.uploadId;
    const answer = await create({ ...STORE_BODY, apkUploadId: up });
    expect(answer.status).toBe(400);
    expect(refs(answer)).toEqual(['apkUploadId']);
  });

  it('refuses a channel that is not there (400) and a channel that is off (409)', async () => {
    const missing = await create({ ...STORE_BODY, channelCode: 'nothing-here' });
    expect(missing.status).toBe(400);
    expect(refs(missing)).toEqual(['channelCode']);
    const channel = channelsState.channels.get('play');
    if (channel) channel.enabled = false;
    const off = await create(STORE_BODY);
    expect(off.status).toBe(409);
    expect(off.body.code).toBe('INVALID_STATE');
  });

  it('refuses a version number the channel has already (409 DUPLICATE_RESOURCE naming the field)', async () => {
    const taken = versionBy('play', 100);
    expect(taken.status).toBe('ARCHIVED');
    // lower than the active one, so the order check comes first; make the active one lower to reach the duplicate
    const active = activeOf('play');
    if (active) active.status = 'ARCHIVED';
    const answer = await create({ ...STORE_BODY, versionCode: 100, minVersionCode: 1 });
    expect(answer.status).toBe(409);
    expect(answer.body.code).toBe('DUPLICATE_RESOURCE');
    expect(answer.body.data).toEqual({ field: 'versionCode' });
  });
});

describe('POST /uploads/apk and a version of a DIRECT channel', () => {
  const DIRECT_BODY = {
    channelCode: 'direct',
    versionName: '1.3.0',
    versionCode: 130,
    minVersionCode: 1,
    changelog: { en: 'Faster calls' },
  };

  it('answers the upload id with the address, size and checksum', async () => {
    const answer = await upload();
    expect(answer.status).toBe(200);
    expect(answer.body.data).toMatchObject({
      uploadId: expect.any(String),
      apkUrl: expect.stringMatching(/^https:\/\//),
      apkSizeBytes: expect.any(Number),
      apkSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect((await upload()).body.data.uploadId).not.toBe(answer.body.data.uploadId);
  });

  it('wants APPVERSION:MANAGE', async () => {
    expect((await upload(['APPVERSION:VIEW'])).status).toBe(403);
    expect((await upload(['APPVERSION:MANAGE'])).status).toBe(200);
  });

  it('answers 503 DEPENDENCY_UNAVAILABLE while upload.public_base_url is not set, and 400 INVALID_FILE for a refused file', async () => {
    appVersionsState.apkAvailable = false;
    const off = await upload();
    expect(off.status).toBe(503);
    expect(off.body.code).toBe('DEPENDENCY_UNAVAILABLE');
    appVersionsState.apkAvailable = true;
    appVersionsState.nextApkRefusal = true;
    const refused = await upload();
    expect(refused.status).toBe(400);
    expect(refused.body.code).toBe('INVALID_FILE');
    expect((await upload()).status).toBe(200);
  });

  it('creates a draft that takes the file from the upload record and ignores file fields in the body', async () => {
    const up = (await upload()).body.data;
    const answer = await create({
      ...DIRECT_BODY,
      apkUploadId: up.uploadId,
      apkUrl: 'https://evil.example/x.apk',
      apkSizeBytes: 1,
      apkSha256: 'f'.repeat(64),
    });
    expect(answer.status).toBe(200);
    expect(answer.body.data).toMatchObject({
      apkUploadId: up.uploadId,
      apkUrl: up.apkUrl,
      apkSizeBytes: up.apkSizeBytes,
      apkSha256: up.apkSha256,
      storeUrl: null,
    });
  });

  it('wants the upload id; refuses a link; refuses an upload that is used, unknown or of another kind', async () => {
    expect(refs(await create(DIRECT_BODY))).toEqual(['apkUploadId']);
    const up = (await upload()).body.data.uploadId;
    expect(refs(await create({ ...DIRECT_BODY, apkUploadId: up, storeUrl: PLAY_URL }))).toEqual([
      'storeUrl',
    ]);
    expect((await create({ ...DIRECT_BODY, apkUploadId: up })).status).toBe(200);
    const used = await create({ ...DIRECT_BODY, versionCode: 131, apkUploadId: up });
    expect(used.status).toBe(409);
    expect(used.body.code).toBe('INVALID_STATE');
    const unknown = await create({ ...DIRECT_BODY, versionCode: 132, apkUploadId: 'nothing' });
    expect(unknown.status).toBe(404);
    expect(unknown.body.code).toBe('RESOURCE_NOT_FOUND');
    const other = (await upload()).body.data.uploadId;
    const record = appVersionsState.uploads.get(other);
    if (record) record.kind = 'AD_MEDIA' as never;
    const wrong = await create({ ...DIRECT_BODY, versionCode: 133, apkUploadId: other });
    expect(wrong.status).toBe(400);
    expect(refs(wrong)).toEqual(['apkUploadId']);
  });
});

describe('PUT /app-versions/{id}: editing a draft', () => {
  const draftOf = (channel: string) => {
    const found = [...appVersionsState.versions.values()].find(
      (v) => v.channelCode === channel && v.status === 'DRAFT',
    );
    if (!found) throw new Error('no draft');
    return found;
  };

  it('changes the fields of a draft of a STORE channel', async () => {
    const draft = draftOf('play');
    const answer = await update(draft.id, {
      versionName: '9.9.9',
      versionCode: draft.versionCode,
      minVersionCode: draft.minVersionCode,
      changelog: { en: 'New', ar: 'جديد' },
      storeUrl: PLAY_URL,
    });
    expect(answer.status).toBe(200);
    expect(appVersionsState.versions.get(draft.id)).toMatchObject({
      versionName: '9.9.9',
      changelog: { en: 'New', ar: 'جديد' },
    });
  });

  it('refuses a version that is not a draft with 409 INVALID_STATE and its state', async () => {
    const active = activeOf('play') as MockVersion;
    const answer = await update(active.id, {
      versionName: '1.0.0',
      versionCode: 999,
      minVersionCode: 1,
      changelog: { en: 'x' },
      storeUrl: PLAY_URL,
    });
    expect(answer.status).toBe(409);
    expect(answer.body.code).toBe('INVALID_STATE');
    expect(answer.body.data).toEqual({ status: 'ACTIVE' });
    const archived = versionBy('play', 100);
    expect((await update(archived.id, {})).body.data).toEqual({ status: 'ARCHIVED' });
  });

  it('answers 404 for a version that is not there and wants APPVERSION:MANAGE', async () => {
    expect((await update('nope', {})).status).toBe(404);
    const draft = draftOf('play');
    expect((await update(draft.id, {}, ['APPVERSION:ACTIVATE'])).status).toBe(403);
  });

  it('checks the version number against the active version again', async () => {
    const draft = draftOf('play');
    const active = activeOf('play') as MockVersion;
    const answer = await update(draft.id, {
      versionName: draft.versionName,
      versionCode: active.versionCode,
      minVersionCode: 1,
      changelog: draft.changelog,
      storeUrl: PLAY_URL,
    });
    expect(answer.status).toBe(400);
    expect(refs(answer)).toEqual(['versionCode']);
  });

  it('does not let the channel be changed', async () => {
    const draft = draftOf('play');
    const answer = await update(draft.id, {
      channelCode: 'appstore',
      versionName: draft.versionName,
      versionCode: draft.versionCode,
      minVersionCode: draft.minVersionCode,
      changelog: draft.changelog,
      storeUrl: PLAY_URL,
    });
    expect(answer.status).toBe(400);
    expect(refs(answer)).toEqual(['channelCode']);
  });

  it('takes the same upload id as no change, and a new one replaces the file and drops the old record', async () => {
    const draft = draftOf('direct');
    const body = {
      versionName: draft.versionName,
      versionCode: draft.versionCode,
      minVersionCode: draft.minVersionCode,
      changelog: draft.changelog,
    };
    expect((await update(draft.id, { ...body, apkUploadId: draft.apkUploadId })).status).toBe(200);
    expect(appVersionsState.uploads.has(draft.apkUploadId as string)).toBe(true);
    const old = draft.apkUploadId as string;
    const fresh = (await upload()).body.data;
    expect((await update(draft.id, { ...body, apkUploadId: fresh.uploadId })).status).toBe(200);
    expect(appVersionsState.versions.get(draft.id)).toMatchObject({
      apkUploadId: fresh.uploadId,
      apkSha256: fresh.apkSha256,
    });
    expect(appVersionsState.uploads.has(old)).toBe(false);
  });
});

describe('PUT /app-versions/{id}/status: activating and taking down', () => {
  const draftOf = (channel: string, code?: number) => {
    const found = [...appVersionsState.versions.values()].find(
      (v) =>
        v.channelCode === channel &&
        v.status === 'DRAFT' &&
        (code === undefined || v.versionCode === code),
    );
    if (!found) throw new Error('no draft');
    return found;
  };

  it('wants confirmStoreLive=true for a STORE channel: without it 400 and nothing changes', async () => {
    const draft = draftOf('play');
    const before = activeOf('play')?.id;
    for (const body of [
      { status: 'ACTIVE' },
      { status: 'ACTIVE', confirmStoreLive: false },
      { status: 'ACTIVE', confirmStoreLive: 'true' },
    ]) {
      const answer = await status(draft.id, body);
      expect(answer.status, JSON.stringify(body)).toBe(400);
      expect(refs(answer)).toEqual(['confirmStoreLive']);
    }
    expect(appVersionsState.versions.get(draft.id)?.status).toBe('DRAFT');
    expect(activeOf('play')?.id).toBe(before);
  });

  it('makes the draft the only active version of its channel and archives the one that was', async () => {
    const draft = draftOf('play');
    const before = activeOf('play') as MockVersion;
    const answer = await status(draft.id, { status: 'ACTIVE', confirmStoreLive: true });
    expect(answer.status).toBe(200);
    expect(answer.body.data).toMatchObject({
      status: 'ACTIVE',
      activatedBy: adminOf('root').id,
      activatedByUsername: 'root',
    });
    expect(answer.body.data.activatedAt).toBeTruthy();
    expect(appVersionsState.versions.get(before.id)?.status).toBe('ARCHIVED');
    const actives = [...appVersionsState.versions.values()].filter(
      (v) => v.channelCode === 'play' && v.status === 'ACTIVE',
    );
    expect(actives).toHaveLength(1);
  });

  it('does not ask a DIRECT channel for confirmStoreLive and ignores it when it is there', async () => {
    const draft = draftOf('direct');
    expect((await status(draft.id, { status: 'ACTIVE' })).status).toBe(200);
    expect(activeOf('direct')?.id).toBe(draft.id);
  });

  it('refuses a draft whose number is not above the active one (the order is checked at activation too)', async () => {
    const draft = draftOf('play');
    const active = activeOf('play') as MockVersion;
    draft.versionCode = active.versionCode;
    draft.minVersionCode = 1;
    const answer = await status(draft.id, { status: 'ACTIVE', confirmStoreLive: true });
    expect(answer.status).toBe(400);
    expect(refs(answer)).toEqual(['versionCode']);
  });

  it('does not activate in a channel that is off (409)', async () => {
    const draft = draftOf('play');
    const channel = channelsState.channels.get('play');
    if (channel) channel.enabled = false;
    const answer = await status(draft.id, { status: 'ACTIVE', confirmStoreLive: true });
    expect(answer.status).toBe(409);
    expect(answer.body.code).toBe('INVALID_STATE');
  });

  it('takes the active version down (ARCHIVED) and never back', async () => {
    const active = activeOf('play') as MockVersion;
    const down = await status(active.id, { status: 'ARCHIVED' });
    expect(down.status).toBe(200);
    expect(down.body.data.status).toBe('ARCHIVED');
    const again = await status(active.id, { status: 'ARCHIVED' });
    expect(again.status).toBe(409);
    expect(again.body.data).toEqual({ status: 'ARCHIVED' });
    const back = await status(active.id, { status: 'ACTIVE', confirmStoreLive: true });
    expect(back.status).toBe(409);
  });

  it('refuses to take a draft down and to activate an active one', async () => {
    const draft = draftOf('play');
    const a = await status(draft.id, { status: 'ARCHIVED' });
    expect(a.status).toBe(409);
    expect(a.body.data).toEqual({ status: 'DRAFT' });
    const active = activeOf('play') as MockVersion;
    expect((await status(active.id, { status: 'ACTIVE', confirmStoreLive: true })).status).toBe(
      409,
    );
  });

  it('refuses a status that is not one of the two targets', async () => {
    const draft = draftOf('play');
    expect(refs(await status(draft.id, { status: 'DRAFT' }))).toEqual(['status']);
    expect(refs(await status(draft.id, {}))).toEqual(['status']);
  });

  it('wants APPVERSION:ACTIVATE: managing is not enough', async () => {
    const draft = draftOf('play');
    expect(
      (await status(draft.id, { status: 'ACTIVE', confirmStoreLive: true }, ['APPVERSION:MANAGE']))
        .status,
    ).toBe(403);
    expect(
      (
        await status(draft.id, { status: 'ACTIVE', confirmStoreLive: true }, [
          'APPVERSION:ACTIVATE',
        ])
      ).status,
    ).toBe(200);
    expect((await status('nope', { status: 'ARCHIVED' })).status).toBe(404);
  });
});

describe('DELETE /app-versions/{id}', () => {
  it('deletes a draft and frees the file of a DIRECT draft; refuses any other state with INVALID_STATE', async () => {
    const draft = [...appVersionsState.versions.values()].find(
      (v) => v.channelCode === 'direct' && v.status === 'DRAFT',
    ) as MockVersion;
    const uploadId = draft.apkUploadId as string;
    expect((await remove(draft.id)).status).toBe(200);
    expect(appVersionsState.versions.has(draft.id)).toBe(false);
    expect(appVersionsState.uploads.has(uploadId)).toBe(false);
    const active = activeOf('play') as MockVersion;
    const refused = await remove(active.id);
    expect(refused.status).toBe(409);
    expect(refused.body.data).toEqual({ status: 'ACTIVE' });
    expect((await remove(versionBy('play', 100).id)).body.data).toEqual({ status: 'ARCHIVED' });
    expect((await remove('nope')).status).toBe(404);
  });

  it('wants APPVERSION:MANAGE', async () => {
    const draft = [...appVersionsState.versions.values()].find(
      (v) => v.status === 'DRAFT',
    ) as MockVersion;
    expect((await remove(draft.id, ['APPVERSION:ACTIVATE'])).status).toBe(403);
    expect((await remove(draft.id, ['APPVERSION:MANAGE'])).status).toBe(200);
  });
});
