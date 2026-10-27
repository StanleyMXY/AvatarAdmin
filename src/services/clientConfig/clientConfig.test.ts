import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { resetSessionState, setToken } from '../../request/session';
import {
  listClientConfig,
  readClientConfigKey,
  resetClientConfig,
  saveClientConfig,
} from './index';

beforeEach(() => {
  resetSessionState();
  sessionStorage.clear();
  setToken('tok');
});
afterEach(() => vi.unstubAllGlobals());

const answer = (data: unknown) => stubFetch(() => jsonResponse(200, envelope('200', data)));
const urlOf = (call: { url: string }) => new URL(call.url, 'http://x');

describe('the client configuration', () => {
  it('reads GET /client-config as it comes: no paging parameters, the order of the backend', async () => {
    const calls = answer({ items: [{ key: 'b' }, { key: 'a' }] });
    expect(await listClientConfig()).toEqual([{ key: 'b' }, { key: 'a' }]);
    const url = urlOf(calls[0]);
    expect([calls[0].init.method, url.pathname, url.search]).toEqual([
      'GET',
      '/api/admin/client-config',
      '',
    ]);
  });

  it('reads an answer that is not a list as an empty list', async () => {
    answer({ items: 'x' });
    expect(await listClientConfig()).toEqual([]);
    answer(null);
    expect(await listClientConfig()).toEqual([]);
  });

  it('reads one key from the same list and gives undefined for a key that is not in it', async () => {
    const calls = answer({
      items: [
        { key: 'b', values: {} },
        { key: 'a', values: { '': 'x' } },
      ],
    });
    expect(await readClientConfigKey('a')).toEqual({ key: 'a', values: { '': 'x' } });
    expect(await readClientConfigKey('missing')).toBeUndefined();
    expect(calls.map((c) => [c.init.method, urlOf(c).pathname])).toEqual([
      ['GET', '/api/admin/client-config'],
      ['GET', '/api/admin/client-config'],
    ]);
  });

  it('saves with PUT /client-config/{key} and the whole values map', async () => {
    const calls = answer({});
    await saveClientConfig('privacyPolicyUrl', {
      '': 'https://example.com/p',
      th: 'https://example.com/th/p',
    });
    expect([calls[0].init.method, urlOf(calls[0]).pathname]).toEqual([
      'PUT',
      '/api/admin/client-config/privacyPolicyUrl',
    ]);
    expect(JSON.parse(calls[0].init.body as string)).toEqual({
      values: { '': 'https://example.com/p', th: 'https://example.com/th/p' },
    });
  });

  it('encodes the key and keeps the empty-string language key', async () => {
    const calls = answer({});
    await saveClientConfig('a/b ä', { '': 'x' });
    expect(urlOf(calls[0]).pathname).toBe('/api/admin/client-config/a%2Fb%20%C3%A4');
    expect(calls[0].init.body).toContain('"":"x"');
  });

  it('resets with POST …/reset and no body', async () => {
    const calls = answer({});
    await resetClientConfig('supportUrl');
    expect([calls[0].init.method, urlOf(calls[0]).pathname]).toEqual([
      'POST',
      '/api/admin/client-config/supportUrl/reset',
    ]);
    expect(calls[0].init.body).toBeUndefined();
  });
});
