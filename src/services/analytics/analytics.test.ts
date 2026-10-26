import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { ApiError } from '../../request/errors';
import { resetSessionState, setToken } from '../../request/session';
import {
  createSavedFunnel,
  deleteSavedFunnel,
  getEventNames,
  getEventSummary,
  getFunnel,
  listEvents,
  listSavedFunnels,
  updateSavedFunnel,
} from './index';

beforeEach(() => {
  resetSessionState();
  sessionStorage.clear();
  setToken('tok');
});
afterEach(() => vi.unstubAllGlobals());

const range = { from: '2026-10-20', to: '2026-10-26' };

describe('analytics services', () => {
  it('reads the event list with the filters, the range and the paging, leaving out empty filters', async () => {
    const calls = stubFetch(() => jsonResponse(200, envelope('200', { items: [], total: 0 })));
    await listEvents({ ...range, page: 2, pageSize: 50, accountId: '2001', eventName: 'app_open' });
    await listEvents({ ...range, page: 1, pageSize: 20, accountId: '', deviceId: '' });
    expect(calls[0].url).toBe(
      '/api/admin/analytics/events?from=2026-10-20&to=2026-10-26&page=2&pageSize=50&accountId=2001&eventName=app_open',
    );
    expect(calls[1].url).toBe(
      '/api/admin/analytics/events?from=2026-10-20&to=2026-10-26&page=1&pageSize=20',
    );
    expect(calls[0].init.method).toBe('GET');
  });

  it('reads the summary and the event names for the range', async () => {
    const calls = stubFetch((c) =>
      jsonResponse(
        200,
        envelope(
          '200',
          c.url.includes('event-names')
            ? { items: ['app_open', 'session_started'] }
            : { items: [{ eventName: 'app_open', pv: 9, uv: 3 }] },
        ),
      ),
    );
    const summary = await getEventSummary(range);
    const names = await getEventNames(range);
    expect(calls[0].url).toBe('/api/admin/analytics/event-summary?from=2026-10-20&to=2026-10-26');
    expect(calls[1].url).toBe('/api/admin/analytics/event-names?from=2026-10-20&to=2026-10-26');
    expect(summary.items).toEqual([{ eventName: 'app_open', pv: 9, uv: 3 }]);
    expect(names.items).toEqual(['app_open', 'session_started']);
  });

  it('joins the funnel steps with commas into one parameter, and keeps the answer as it is', async () => {
    const calls = stubFetch(() =>
      jsonResponse(
        200,
        envelope('200', {
          steps: [
            { eventName: 'a', count: 10, conversionFromPrevious: null },
            { eventName: 'b', count: 0, conversionFromPrevious: 0 },
          ],
        }),
      ),
    );
    const answer = await getFunnel({ ...range, steps: ['a', 'b'], windowHours: 24 });
    const url = new URL(calls[0].url, 'http://x');
    expect(url.pathname).toBe('/api/admin/analytics/funnel');
    expect(url.searchParams.get('steps')).toBe('a,b');
    expect(url.searchParams.get('windowHours')).toBe('24');
    expect(url.searchParams.get('from')).toBe('2026-10-20');
    expect(answer.steps[1]).toEqual({ eventName: 'b', count: 0, conversionFromPrevious: 0 });
  });

  it('lists, creates, changes and deletes saved funnels on the paths of the contract', async () => {
    const funnel = {
      id: '7',
      name: 'x',
      steps: ['a', 'b'],
      windowHours: 24,
      isPreset: false,
    };
    const calls = stubFetch((c) =>
      jsonResponse(200, envelope('200', c.init.method === 'GET' ? { items: [funnel] } : funnel)),
    );
    expect(await listSavedFunnels()).toEqual([funnel]);
    await createSavedFunnel({ name: 'x', steps: ['a', 'b'], windowHours: 24 });
    await updateSavedFunnel('7', { name: 'y', steps: ['a', 'b', 'c'], windowHours: 48 });
    await deleteSavedFunnel('7');
    expect(calls.map((c) => [c.init.method, c.url])).toEqual([
      ['GET', '/api/admin/analytics/funnels'],
      ['POST', '/api/admin/analytics/funnels'],
      ['PUT', '/api/admin/analytics/funnels/7'],
      ['DELETE', '/api/admin/analytics/funnels/7'],
    ]);
    expect(JSON.parse(String(calls[1].init.body))).toEqual({
      name: 'x',
      steps: ['a', 'b'],
      windowHours: 24,
    });
    expect(JSON.parse(String(calls[2].init.body))).toEqual({
      name: 'y',
      steps: ['a', 'b', 'c'],
      windowHours: 48,
    });
  });

  it('accepts a bare array as the list of saved funnels', async () => {
    stubFetch(() => jsonResponse(200, envelope('200', [])));
    expect(await listSavedFunnels()).toEqual([]);
  });

  it('turns a refusal of the backend into an ApiError with its code', async () => {
    stubFetch(() =>
      jsonResponse(
        400,
        envelope('INVALID_REQUEST', { details: [{ ref: 'to', reason: 'OUT_OF_RANGE' }] }),
      ),
    );
    await expect(getEventSummary(range)).rejects.toMatchObject({
      constructor: ApiError,
      code: 'INVALID_REQUEST',
    });
  });
});
