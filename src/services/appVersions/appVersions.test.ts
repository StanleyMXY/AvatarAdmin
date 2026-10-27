import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { resetSessionState, setToken } from '../../request/session';
import {
  createAppVersion,
  deleteAppVersion,
  getAppVersion,
  listAppVersions,
  readActiveVersion,
  setAppVersionStatus,
  updateAppVersion,
} from './index';

beforeEach(() => {
  resetSessionState();
  sessionStorage.clear();
  setToken('tok');
});
afterEach(() => vi.unstubAllGlobals());

const answer = (data: unknown) => stubFetch(() => jsonResponse(200, envelope('200', data)));
const body = (call: { init: RequestInit }) => JSON.parse(call.init.body as string);
const params = (url: string) => Object.fromEntries(new URL(url, 'http://x').searchParams);
const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: String(i + 1) }));

describe('listing the versions (contract 24.2)', () => {
  it('asks with the filters that were given and the paging, and leaves out the ones that were not', async () => {
    const calls = answer({ items: [{ id: '1' }], total: 1 });
    expect(
      await listAppVersions({
        channelCode: 'play',
        platform: 'ANDROID',
        status: 'DRAFT',
        page: 2,
        pageSize: 50,
      }),
    ).toEqual({ items: [{ id: '1' }], total: 1 });
    expect(new URL(calls[0].url, 'http://x').pathname).toBe('/api/admin/app-versions');
    expect(params(calls[0].url)).toEqual({
      channelCode: 'play',
      platform: 'ANDROID',
      status: 'DRAFT',
      page: '2',
      pageSize: '50',
    });
    await listAppVersions({ page: 1, pageSize: 20 });
    expect(params(calls[1].url)).toEqual({ page: '1', pageSize: '20' });
  });

  it('reads a bare list, and a page without a total, as one whole list and pages it here', async () => {
    answer(rows(45));
    expect(await listAppVersions({ page: 3, pageSize: 20 })).toEqual({
      items: rows(45).slice(40),
      total: 45,
    });
    answer({ items: rows(45) });
    expect(await listAppVersions({ page: 1, pageSize: 20 })).toEqual({
      items: rows(20),
      total: 45,
    });
  });

  it('pages here also when the backend ignored the paging and sent more than a page', async () => {
    answer({ items: rows(30), total: 30 });
    expect(await listAppVersions({ page: 2, pageSize: 20 })).toEqual({
      items: rows(30).slice(20),
      total: 30,
    });
  });

  it('keeps the backend page when it paged', async () => {
    answer({ items: rows(20), total: 95 });
    expect(await listAppVersions({ page: 2, pageSize: 20 })).toEqual({
      items: rows(20),
      total: 95,
    });
  });

  it('survives an answer of another shape', async () => {
    for (const data of [null, 'x', 7, {}, { items: 'x' }, { items: null, total: 3 }]) {
      answer(data);
      expect(await listAppVersions({ page: 1, pageSize: 20 })).toEqual({ items: [], total: 0 });
    }
  });

  it('drops rows that are not objects', async () => {
    answer({ items: [{ id: '1' }, null, 'x', 4, [1]], total: 5 });
    expect((await listAppVersions({ page: 1, pageSize: 20 })).items).toEqual([{ id: '1' }]);
  });
});

describe('the version that is active in a channel', () => {
  it('asks for the active versions of that channel and returns the one of the channel', async () => {
    const calls = answer({
      items: [
        { id: '9', channelCode: 'direct', status: 'ACTIVE', versionCode: 5 },
        { id: '8', channelCode: 'play', status: 'ARCHIVED', versionCode: 4 },
        { id: '7', channelCode: 'play', status: 'ACTIVE', versionCode: 120 },
      ],
      total: 3,
    });
    const found = await readActiveVersion('play');
    expect(found?.id).toBe('7');
    expect(params(calls[0].url)).toMatchObject({ channelCode: 'play', status: 'ACTIVE' });
  });

  it('is null when there is none (nothing that is active in that channel)', async () => {
    answer({
      items: [{ id: '8', channelCode: 'play', status: 'ARCHIVED', versionCode: 4 }],
      total: 1,
    });
    expect(await readActiveVersion('play')).toBeNull();
    answer({ items: [], total: 0 });
    expect(await readActiveVersion('play')).toBeNull();
  });

  it('lets a failure through, so the caller can say the number is not known', async () => {
    stubFetch(() => jsonResponse(403, envelope('ADMIN_FORBIDDEN')));
    await expect(readActiveVersion('play')).rejects.toMatchObject({ code: 'ADMIN_FORBIDDEN' });
  });
});

describe('reading and writing one version', () => {
  it('reads one version by its id, in the path as a safe segment', async () => {
    const calls = answer({ id: 'a/b' });
    await getAppVersion('a/b');
    expect(new URL(calls[0].url, 'http://x').pathname).toBe('/api/admin/app-versions/a%2Fb');
  });

  it('creates with the body as it is given', async () => {
    const calls = answer({ id: '1' });
    const input = {
      channelCode: 'play',
      versionName: '1.2.3',
      versionCode: 121,
      minVersionCode: 100,
      changelog: { en: 'Fixes', th: 'ปรับปรุง' },
      storeUrl: 'https://play.google.com/store/apps/details?id=com.example.avatar',
    };
    await createAppVersion(input);
    expect(calls[0].init.method).toBe('POST');
    expect(new URL(calls[0].url, 'http://x').pathname).toBe('/api/admin/app-versions');
    expect(body(calls[0])).toEqual(input);
  });

  it('creates a version of a DIRECT channel with the upload id and nothing about the file', async () => {
    const calls = answer({ id: '1' });
    await createAppVersion({
      channelCode: 'direct',
      versionName: '1.2.3',
      versionCode: 121,
      minVersionCode: 1,
      changelog: { en: 'Fixes' },
      apkUploadId: 'up-1',
    });
    expect(body(calls[0])).toEqual({
      channelCode: 'direct',
      versionName: '1.2.3',
      versionCode: 121,
      minVersionCode: 1,
      changelog: { en: 'Fixes' },
      apkUploadId: 'up-1',
    });
    expect(Object.keys(body(calls[0]))).not.toEqual(
      expect.arrayContaining(['apkUrl', 'apkSizeBytes', 'apkSha256']),
    );
  });

  it('updates a draft with PUT on its id', async () => {
    const calls = answer({ id: '1' });
    await updateAppVersion('7', {
      versionName: '1.2.4',
      versionCode: 122,
      minVersionCode: 5,
      changelog: { en: 'x' },
      storeUrl: 'https://play.google.com/store/apps/details?id=com.example.avatar',
    });
    expect(calls[0].init.method).toBe('PUT');
    expect(new URL(calls[0].url, 'http://x').pathname).toBe('/api/admin/app-versions/7');
    expect(body(calls[0]).versionCode).toBe(122);
  });

  it('activates with confirmStoreLive only when it is given', async () => {
    const calls = answer({ id: '1' });
    await setAppVersionStatus('7', 'ACTIVE', true);
    await setAppVersionStatus('8', 'ACTIVE');
    await setAppVersionStatus('9', 'ARCHIVED');
    expect(calls.map((c) => [c.init.method, new URL(c.url, 'http://x').pathname])).toEqual([
      ['PUT', '/api/admin/app-versions/7/status'],
      ['PUT', '/api/admin/app-versions/8/status'],
      ['PUT', '/api/admin/app-versions/9/status'],
    ]);
    expect(body(calls[0])).toEqual({ status: 'ACTIVE', confirmStoreLive: true });
    expect(body(calls[1])).toEqual({ status: 'ACTIVE' });
    expect(body(calls[2])).toEqual({ status: 'ARCHIVED' });
  });

  it('deletes a draft with DELETE on its id', async () => {
    const calls = answer(null);
    await deleteAppVersion('7');
    expect(calls[0].init.method).toBe('DELETE');
    expect(new URL(calls[0].url, 'http://x').pathname).toBe('/api/admin/app-versions/7');
  });

  it('lets the error of the backend through', async () => {
    stubFetch(() => jsonResponse(409, envelope('INVALID_STATE', { status: 'ACTIVE' })));
    await expect(deleteAppVersion('7')).rejects.toMatchObject({
      code: 'INVALID_STATE',
      data: { status: 'ACTIVE' },
    });
  });
});
