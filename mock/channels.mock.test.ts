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
// Answers 90: every 400 of the channels is INVALID_REQUEST with an English message and no details
// (no ref, no reason code), so a test looks at the message for the field it is about.
type Answer = { status: number; body: { code: string; message: string; data: unknown } };
const refused = (answer: Answer): string => {
  expect([answer.status, answer.body.code, answer.body.data]).toEqual([
    400,
    'INVALID_REQUEST',
    null,
  ]);
  return answer.body.message;
};

describe('GET /channels', () => {
  it('lists the three preset channels to any signed-in administrator, with the column names of the contract', async () => {
    const answer = await list('support');
    expect(answer.status).toBe(200);
    const items = answer.body.data.items;
    expect(items.map((c: { code: string }) => c.code)).toEqual(['play', 'direct', 'appstore']);
    expect(items[0]).toMatchObject({
      code: 'play',
      name: 'Android store',
      platform: 'ANDROID',
      distribution: 'STORE',
      packageName: 'app.example.play',
      enabled: true,
    });
    // the contract's column is `code`; there is no `channelCode`
    expect(items[0]).not.toHaveProperty('channelCode');
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
      expect(refused(answer), String(code)).toMatch(/code/);
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

  it('refuses a platform or distribution that is not one of the two, an empty name, and DIRECT for iOS, with no details', async () => {
    expect(refused(await create({ ...NEW, platform: 'WEB' }))).toMatch(/platform/);
    expect(refused(await create({ ...NEW, distribution: 'OTHER' }))).toMatch(/distribution/);
    expect(refused(await create({ ...NEW, name: '   ' }))).toMatch(/name/);
    expect(refused(await create({ ...NEW, name: undefined }))).toMatch(/name/);
    expect(refused(await create({ ...NEW, platform: 'IOS', distribution: 'DIRECT' }))).toMatch(
      /DIRECT|distribution/,
    );
    expect(
      (await create({ ...NEW, code: 'ios-store', platform: 'IOS', distribution: 'STORE' })).status,
    ).toBe(200);
  });

  // Answers 90: the name has 1 to 64 code points after the ends are cut; the package name is at most
  // 255 characters of A-Z a-z 0-9 . _ - and may be left out.
  it('takes a name of 1 to 64 code points, counted as code points, and refuses 65', async () => {
    const emoji = String.fromCodePoint(0x1f600);
    for (const [name, code] of [
      ['a', 'n-a'],
      ['ก'.repeat(64), 'n-th'],
      [emoji.repeat(64), 'n-emoji'],
      [`  ${'ع'.repeat(64)}  `, 'n-ar'],
    ] as const) {
      expect((await create({ ...NEW, code, name })).status, code).toBe(200);
    }
    for (const name of ['a'.repeat(65), emoji.repeat(65), 'ñ'.repeat(65)]) {
      expect(refused(await create({ ...NEW, code: 'too-long', name })), name).toMatch(/name/);
    }
    expect(channelsState.channels.has('too-long')).toBe(false);
  });

  it('takes a package name of at most 255 characters of the allowed set, and refuses 256 or another character', async () => {
    expect((await create({ ...NEW, code: 'pkg-255', packageName: 'a'.repeat(255) })).status).toBe(
      200,
    );
    expect(
      refused(await create({ ...NEW, code: 'pkg-256', packageName: 'a'.repeat(256) })),
    ).toMatch(/packageName/);
    for (const packageName of ['com example', 'com/example', 'com.ตัวอย่าง', 'a:b']) {
      expect(refused(await create({ ...NEW, code: 'pkg-bad', packageName })), packageName).toMatch(
        /packageName/,
      );
    }
  });

  it('tests the fields in the order code, name, platform, distribution, DIRECT with iOS, package name, and answers the first that is wrong', async () => {
    const all = {
      code: 'Bad Code',
      name: '',
      platform: 'WEB',
      distribution: 'OTHER',
      packageName: 'bad name',
    };
    expect(refused(await create(all))).toMatch(/code/);
    expect(refused(await create({ ...all, code: 'ok-code' }))).toMatch(/name/);
    expect(refused(await create({ ...all, code: 'ok-code', name: 'n' }))).toMatch(/platform/);
    expect(refused(await create({ ...all, code: 'ok-code', name: 'n', platform: 'IOS' }))).toMatch(
      /distribution/,
    );
    expect(
      refused(
        await create({
          ...all,
          code: 'ok-code',
          name: 'n',
          platform: 'IOS',
          distribution: 'DIRECT',
        }),
      ),
    ).toMatch(/DIRECT|distribution/);
    expect(
      refused(
        await create({
          ...all,
          code: 'ok-code',
          name: 'n',
          platform: 'IOS',
          distribution: 'STORE',
        }),
      ),
    ).toMatch(/packageName/);
  });

  it('is enabled when enabled is not sent, and switched off only by an explicit false', async () => {
    expect((await create({ ...NEW, code: 'on-1' })).body.data.enabled).toBe(true);
    expect((await create({ ...NEW, code: 'on-2', enabled: null })).body.data.enabled).toBe(true);
    expect((await create({ ...NEW, code: 'off-1', enabled: false })).body.data.enabled).toBe(false);
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

  // Answers 89 and 90: a PUT takes the fields that are named and leaves the others; null is "not named"
  // (a name or a package name), an empty text clears the package name, a blank name is 400.
  it('takes the fields that are given and leaves the others: {enabled} alone, {name} alone', async () => {
    await update('play', { enabled: false });
    expect(channelsState.channels.get('play')).toMatchObject({
      name: 'Android store',
      packageName: 'app.example.play',
      enabled: false,
    });
    await update('play', { name: 'Only the name' });
    expect(channelsState.channels.get('play')).toMatchObject({
      name: 'Only the name',
      packageName: 'app.example.play',
      enabled: false,
    });
    await update('play', { enabled: true });
    expect(channelsState.channels.get('play')).toMatchObject({
      name: 'Only the name',
      enabled: true,
    });
  });

  it('keeps the package name for null, clears it for an empty text', async () => {
    await update('play', { packageName: null });
    expect(channelsState.channels.get('play')?.packageName).toBe('app.example.play');
    await update('play', { name: null, enabled: null });
    expect(channelsState.channels.get('play')).toMatchObject({
      name: 'Android store',
      enabled: true,
    });
    await update('play', { packageName: '' });
    expect(channelsState.channels.get('play')?.packageName).toBeNull();
  });

  it('refuses to change the code, the platform or the distribution', async () => {
    for (const body of [{ code: 'other' }, { platform: 'IOS' }, { distribution: 'DIRECT' }]) {
      const answer = await update('play', { name: 'x', ...body });
      refused(answer);
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

  it('refuses a blank name, a name of 65 code points, a package name that is too long, and enabled of the wrong type', async () => {
    expect(refused(await update('play', { name: ' ' }))).toMatch(/name/);
    expect(refused(await update('play', { name: 'a'.repeat(65) }))).toMatch(/name/);
    expect(refused(await update('play', { packageName: 'a'.repeat(256) }))).toMatch(/packageName/);
    expect(refused(await update('play', { enabled: 'yes' }))).toMatch(/enabled/);
    expect(channelsState.channels.get('play')?.name).toBe('Android store');
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
