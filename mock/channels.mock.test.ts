import { beforeEach, describe, expect, it } from 'vitest';
import type { PermissionCode } from '../src/access/permissionCodes';
import { channelsState, resetChannelsStore } from './_core/channelsData';
import { issueToken, resetStore } from './_core/store';
import { adminOf, bearer, call } from './_core/testing';
import channels from './channels.mock';

beforeEach(() => {
  resetStore();
  resetChannelsStore();
});

type H = Parameters<typeof call>[0];
const h = (name: string) => (channels as unknown as Record<string, H>)[name];
const tokenOf = (user: string, codes?: PermissionCode[]) => {
  const admin = adminOf(user);
  if (codes) admin.permissions = codes;
  return bearer(issueToken(admin).token).authorization;
};
const LIST = 'GET /api/admin/channels';
const CREATE = 'POST /api/admin/channels';
const UPDATE = 'PUT /api/admin/channels/:code';
const list = (user = 'root') => call(h(LIST), { headers: { authorization: tokenOf(user) } });
const create = (body: unknown, user = 'root', codes?: PermissionCode[]) =>
  call(h(CREATE), { headers: { authorization: tokenOf(user, codes) }, body });
const update = (code: string, body: unknown, user = 'root', codes?: PermissionCode[]) =>
  call(h(UPDATE), { headers: { authorization: tokenOf(user, codes) }, body, params: { code } });

const NEW = {
  code: 'partner-th',
  name: 'พันธมิตร ไทย',
  platform: 'ANDROID',
  distribution: 'DIRECT',
  packageName: 'com.example.partner',
};
const refs = (answer: { body: { data: { details?: { ref: string }[] } } }) =>
  (answer.body.data.details ?? []).map((d) => d.ref);

describe('GET /channels', () => {
  it('lists the three preset channels to any signed-in administrator, with the column names of the contract', async () => {
    const answer = await list('support');
    expect(answer.status).toBe(200);
    const items = answer.body.data.items;
    expect(items.map((c: { code: string }) => c.code)).toEqual(['play', 'direct', 'appstore']);
    expect(items[0]).toMatchObject({
      code: 'play',
      channelCode: 'play',
      name: 'Android store',
      platform: 'ANDROID',
      distribution: 'STORE',
      packageName: 'app.example.play',
      enabled: true,
    });
    expect(items[1]).toMatchObject({ code: 'direct', distribution: 'DIRECT' });
    expect(items[2]).toMatchObject({ code: 'appstore', platform: 'IOS', packageName: null });
  });

  it('wants a sign-in', async () => {
    expect((await call(h(LIST))).status).toBe(401);
  });

  it('gives a copy: changing the answer does not change the store', async () => {
    const answer = await list();
    answer.body.data.items[0].name = 'changed';
    expect(channelsState.channels.get('play')?.name).toBe('Android store');
  });
});

describe('POST /channels', () => {
  it('creates a channel that the list then shows, enabled', async () => {
    const answer = await create(NEW);
    expect(answer.status).toBe(200);
    expect(answer.body.data).toMatchObject({ ...NEW, enabled: true });
    const items = (await list()).body.data.items;
    expect(items.at(-1)).toMatchObject({ code: 'partner-th', name: 'พันธมิตร ไทย', enabled: true });
  });

  it('wants CHANNEL:MANAGE; reading the list is not enough', async () => {
    expect((await create(NEW, 'support', ['APPVERSION:VIEW'])).status).toBe(403);
    expect((await create(NEW, 'support', ['CHANNEL:MANAGE'])).status).toBe(200);
    expect((await call(h(CREATE), { body: NEW })).status).toBe(401);
  });

  it('refuses a code that does not fit ^[a-z0-9_-]{2,32}$ and the reserved code unknown', async () => {
    for (const code of [
      '',
      'a',
      'A1',
      'has space',
      'x'.repeat(33),
      'ก-ข',
      'unknown',
      'a.b',
      5,
      null,
      undefined,
    ]) {
      const answer = await create({ ...NEW, code });
      expect(answer.status, String(code)).toBe(400);
      expect(answer.body.code).toBe('INVALID_REQUEST');
      expect(refs(answer)).toEqual(['code']);
    }
    expect((await create({ ...NEW, code: 'ab' })).status).toBe(200);
    expect((await create({ ...NEW, code: 'x'.repeat(32) })).status).toBe(200);
  });

  it('refuses an existing code with DUPLICATE_RESOURCE naming the field', async () => {
    const answer = await create({ ...NEW, code: 'play' });
    expect(answer.status).toBe(409);
    expect(answer.body.code).toBe('DUPLICATE_RESOURCE');
    expect(answer.body.data).toEqual({ field: 'code' });
  });

  it('refuses a platform or distribution that is not one of the two, an empty name, and DIRECT for iOS', async () => {
    expect(refs(await create({ ...NEW, platform: 'WEB' }))).toEqual(['platform']);
    expect(refs(await create({ ...NEW, distribution: 'OTHER' }))).toEqual(['distribution']);
    expect(refs(await create({ ...NEW, name: '   ' }))).toEqual(['name']);
    expect(refs(await create({ ...NEW, name: undefined }))).toEqual(['name']);
    const ios = await create({ ...NEW, platform: 'IOS', distribution: 'DIRECT' });
    expect(ios.status).toBe(400);
    expect(refs(ios)).toEqual(['distribution']);
    expect(
      (await create({ ...NEW, code: 'ios-store', platform: 'IOS', distribution: 'STORE' })).status,
    ).toBe(200);
  });

  it('takes a missing or blank package name as none', async () => {
    const a = await create({ ...NEW, code: 'no-pkg-a', packageName: null });
    const b = await create({ ...NEW, code: 'no-pkg-b', packageName: '  ' });
    const c = await create({ ...NEW, code: 'no-pkg-c', packageName: undefined });
    for (const answer of [a, b, c]) expect(answer.body.data.packageName).toBeNull();
  });
});

describe('PUT /channels/{code}', () => {
  it('changes the name, the package name and enabled', async () => {
    const answer = await update('play', {
      name: 'Play (Thai)',
      packageName: 'com.new.id',
      enabled: false,
    });
    expect(answer.status).toBe(200);
    const row = channelsState.channels.get('play');
    expect(row).toMatchObject({ name: 'Play (Thai)', packageName: 'com.new.id', enabled: false });
    expect(row?.updatedAt).not.toBe('2026-10-01T00:00:00Z');
  });

  it('takes the fields that are given and leaves the others', async () => {
    await update('play', { enabled: false });
    expect(channelsState.channels.get('play')).toMatchObject({
      name: 'Android store',
      enabled: false,
    });
    await update('play', { packageName: null });
    expect(channelsState.channels.get('play')?.packageName).toBeNull();
  });

  it('refuses to change the code, the platform or the distribution', async () => {
    for (const body of [{ code: 'other' }, { platform: 'IOS' }, { distribution: 'DIRECT' }]) {
      const answer = await update('play', { name: 'x', ...body });
      expect(answer.status, JSON.stringify(body)).toBe(400);
      expect(answer.body.code).toBe('INVALID_REQUEST');
    }
    expect(channelsState.channels.get('play')?.name).toBe('Android store');
    // saying what it already is changes nothing and is accepted
    expect(
      (
        await update('play', {
          name: 'x',
          code: 'play',
          platform: 'ANDROID',
          distribution: 'STORE',
        })
      ).status,
    ).toBe(200);
  });

  it('refuses an empty name and a name or enabled of the wrong type', async () => {
    expect(refs(await update('play', { name: ' ' }))).toEqual(['name']);
    expect(refs(await update('play', { enabled: 'yes' }))).toEqual(['enabled']);
  });

  it('answers 404 for a channel that is not there, and 403 without CHANNEL:MANAGE', async () => {
    expect((await update('nope', { name: 'x' })).status).toBe(404);
    expect((await update('play', { name: 'x' }, 'support', ['APPVERSION:VIEW'])).status).toBe(403);
  });
});

describe('there is no delete', () => {
  it('has no DELETE handler', () => {
    expect(Object.keys(channels).filter((key) => key.startsWith('DELETE'))).toEqual([]);
  });
});
