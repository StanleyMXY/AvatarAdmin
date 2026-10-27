import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { ApiError } from '../../request/errors';
import { resetSessionState, setToken } from '../../request/session';
import { getNotification, listNotifications, sendNotifications } from './index';

beforeEach(() => {
  resetSessionState();
  sessionStorage.clear();
  setToken('tok');
});
afterEach(() => vi.unstubAllGlobals());

const answer = (data: unknown) => stubFetch(() => jsonResponse(200, envelope('200', data)));
const urlOf = (call: { url: string }) => new URL(call.url, 'http://x');

describe('the notification list', () => {
  it('asks GET /notifications with the paging and only the filters that have a value', async () => {
    const calls = answer({ items: [], total: 0 });
    await listNotifications({
      page: 2,
      pageSize: 50,
      accountId: 'acc-1',
      category: 'ADMIN',
      isRead: false,
      from: '2026-10-01T00:00:00Z',
      to: '2026-10-08T00:00:00Z',
    });
    const url = urlOf(calls[0]);
    expect([calls[0].init.method, url.pathname]).toEqual(['GET', '/api/admin/notifications']);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      page: '2',
      pageSize: '50',
      accountId: 'acc-1',
      category: 'ADMIN',
      isRead: 'false',
      from: '2026-10-01T00:00:00Z',
      to: '2026-10-08T00:00:00Z',
    });
  });

  it('leaves out a filter that is not given, and keeps isRead=false (false is a value)', async () => {
    const calls = answer({ items: [], total: 0 });
    await listNotifications({ page: 1, pageSize: 20 });
    expect(Object.fromEntries(urlOf(calls[0]).searchParams)).toEqual({ page: '1', pageSize: '20' });
    await listNotifications({ page: 1, pageSize: 20, isRead: false });
    expect(urlOf(calls[1]).searchParams.get('isRead')).toBe('false');
  });
});

describe('the notification detail', () => {
  it('asks GET /notifications/{id} and encodes the id', async () => {
    const calls = answer({ id: 'n/1' });
    await getNotification('n/1 ä');
    expect(urlOf(calls[0]).pathname).toBe('/api/admin/notifications/n%2F1%20%C3%A4');
    expect(calls[0].init.method).toBe('GET');
  });
});

describe('sending', () => {
  it('posts the body as it is given and returns how many were created', async () => {
    const calls = answer({ created: 2 });
    const body = {
      accountIds: ['a', 'b'],
      titleI18n: { en: 'Hi' },
      bodyI18n: { en: 'Body' },
      linkType: 'SCREEN' as const,
      linkTarget: 'store',
      push: true,
    };
    expect(await sendNotifications(body)).toEqual({ created: 2 });
    expect([calls[0].init.method, urlOf(calls[0]).pathname]).toEqual([
      'POST',
      '/api/admin/notifications/send',
    ]);
    expect(JSON.parse(calls[0].init.body as string)).toEqual(body);
  });

  it('reads the details of a refused batch: one entry per bad account', async () => {
    stubFetch(() =>
      jsonResponse(
        400,
        envelope('INVALID_REQUEST', {
          details: [
            { ref: 'acc-9', reason: 'ACCOUNT_NOT_FOUND' },
            { ref: 'acc-8', reason: 'ACCOUNT_NOT_ACTIVE' },
          ],
        }),
      ),
    );
    const error = await sendNotifications({
      accountIds: ['acc-9', 'acc-8'],
      titleI18n: { en: 't' },
      bodyI18n: { en: 'b' },
      push: false,
    }).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.details).toEqual([
      { ref: 'acc-9', reason: 'ACCOUNT_NOT_FOUND' },
      { ref: 'acc-8', reason: 'ACCOUNT_NOT_ACTIVE' },
    ]);
  });
});
