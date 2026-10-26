import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { resetSessionState, setToken } from '../../request/session';
import { createChannelPackage, listChannelPackages, updateChannelPackage } from './index';

beforeEach(() => {
  resetSessionState();
  sessionStorage.clear();
  setToken('tok');
});
afterEach(() => vi.unstubAllGlobals());

const answer = (data: unknown) => stubFetch(() => jsonResponse(200, envelope('200', data)));
const body = (call: { init: RequestInit }) => JSON.parse(call.init.body as string);

const row = (code: string, extra: Record<string, unknown> = {}) => ({
  code,
  name: `name of ${code}`,
  platform: 'ANDROID',
  distribution: 'STORE',
  packageName: 'com.example.avatar',
  enabled: true,
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-02T00:00:00Z',
  ...extra,
});

describe('listing the channel packages (contract 24.7)', () => {
  it('reads the code from `code`, as the contract names the column', async () => {
    const calls = answer({ items: [row('play'), row('direct', { distribution: 'DIRECT' })] });
    const list = await listChannelPackages();
    expect(new URL(calls[0].url, 'http://x').pathname).toBe('/api/admin/channels');
    expect(list.map((c) => [c.code, c.distribution, c.enabled])).toEqual([
      ['play', 'STORE', true],
      ['direct', 'DIRECT', true],
    ]);
  });

  it('also reads `channelCode`, which the first channel list of this project used', async () => {
    answer({
      items: [
        {
          channelCode: 'play',
          name: 'Play',
          platform: 'ANDROID',
          distribution: 'STORE',
          enabled: true,
        },
      ],
    });
    expect((await listChannelPackages())[0]).toMatchObject({
      code: 'play',
      name: 'Play',
      packageName: null,
      createdAt: null,
    });
  });

  it('reads a bare list and drops rows without a code or that are not objects', async () => {
    answer([
      row('play'),
      { name: 'no code' },
      null,
      'x',
      { code: 5 },
      { code: '' },
      row('appstore', { platform: 'IOS' }),
    ]);
    expect((await listChannelPackages()).map((c) => c.code)).toEqual(['play', 'appstore']);
  });

  it('turns missing or odd fields into values the page can show', async () => {
    answer({
      items: [
        {
          code: 'x',
          name: 7,
          packageName: { a: 1 },
          enabled: 'yes',
          platform: null,
          distribution: undefined,
        },
      ],
    });
    expect((await listChannelPackages())[0]).toEqual({
      code: 'x',
      name: '7',
      platform: '',
      distribution: '',
      packageName: '{"a":1}',
      enabled: false,
      createdAt: null,
      updatedAt: null,
    });
  });

  it('is an empty list for an answer of another shape', async () => {
    for (const data of [null, 'x', 7, {}, { items: 'x' }]) {
      answer(data);
      expect(await listChannelPackages()).toEqual([]);
    }
  });
});

describe('creating and changing a channel package', () => {
  it('creates with the five fields of the dialog', async () => {
    const calls = answer(row('partner-th'));
    await createChannelPackage({
      code: 'partner-th',
      name: 'พันธมิตร',
      platform: 'ANDROID',
      distribution: 'DIRECT',
      packageName: 'com.example.avatar',
    });
    expect(calls[0].init.method).toBe('POST');
    expect(new URL(calls[0].url, 'http://x').pathname).toBe('/api/admin/channels');
    expect(body(calls[0])).toEqual({
      code: 'partner-th',
      name: 'พันธมิตร',
      platform: 'ANDROID',
      distribution: 'DIRECT',
      packageName: 'com.example.avatar',
    });
  });

  it('changes only the three fields the contract allows, on the code in the path', async () => {
    const calls = answer(row('play'));
    await updateChannelPackage('a/b', { name: 'New', packageName: null, enabled: false });
    expect(calls[0].init.method).toBe('PUT');
    expect(new URL(calls[0].url, 'http://x').pathname).toBe('/api/admin/channels/a%2Fb');
    expect(body(calls[0])).toEqual({ name: 'New', packageName: null, enabled: false });
  });

  it('has no way to delete', async () => {
    const service = await import('./index');
    expect(Object.keys(service).filter((name) => /delete|remove/i.test(name))).toEqual([]);
  });
});
