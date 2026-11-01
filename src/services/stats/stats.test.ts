import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { resetSessionState, setToken } from '../../request/session';
import { getChannels } from '../channels/getChannels';
import {
  fillMissingDays,
  getCheckinDailyUsers,
  getCheckinStreakBuckets,
  getDaily,
  getGuestCohort,
  getGuestDaily,
  getGuestQuota,
  getGuestRetention,
  getPushStats,
  getReactivation,
  getRetention,
  getSessionQuality,
  getTasksDaily,
  getTasksSummary,
  getUsageCost,
  LAND_NAMES,
  landStat,
} from './index';

beforeEach(() => {
  resetSessionState();
  sessionStorage.clear();
  setToken('tok');
});
afterEach(() => vi.unstubAllGlobals());

const range = { from: '2026-10-01', to: '2026-10-07' };

describe('the report functions', () => {
  it.each([
    [
      'getDaily',
      () => getDaily({ ...range, platform: 'ANDROID', channel: 'play' }),
      '/api/admin/stats/daily?from=2026-10-01&to=2026-10-07&platform=ANDROID&channel=play',
    ],
    [
      'getRetention',
      () => getRetention({ ...range, type: 'CALL' }),
      '/api/admin/stats/retention?from=2026-10-01&to=2026-10-07&type=CALL',
    ],
    [
      'getReactivation',
      () => getReactivation({ ...range, silenceDays: 14 }),
      '/api/admin/stats/reactivation?from=2026-10-01&to=2026-10-07&silenceDays=14',
    ],
    [
      'getGuestDaily',
      () => getGuestDaily(range),
      '/api/admin/stats/guest/daily?from=2026-10-01&to=2026-10-07',
    ],
    [
      'getGuestCohort',
      () => getGuestCohort(range),
      '/api/admin/stats/guest/cohort?from=2026-10-01&to=2026-10-07',
    ],
    [
      'getGuestRetention',
      () => getGuestRetention({ ...range, platform: 'IOS' }),
      '/api/admin/stats/guest/retention?from=2026-10-01&to=2026-10-07&platform=IOS',
    ],
    [
      'getSessionQuality',
      () => getSessionQuality(range),
      '/api/admin/stats/session-quality?from=2026-10-01&to=2026-10-07',
    ],
    [
      'getPushStats',
      () => getPushStats({ ...range, triggerReason: 'recall' }),
      '/api/admin/stats/push?from=2026-10-01&to=2026-10-07&triggerReason=recall',
    ],
    [
      'getUsageCost',
      () => getUsageCost({ ...range, currency: 'USD' }),
      '/api/admin/stats/usage-cost?from=2026-10-01&to=2026-10-07&currency=USD',
    ],
    [
      'getCheckinDailyUsers',
      () => getCheckinDailyUsers(range),
      '/api/admin/stats/checkin/daily-users?from=2026-10-01&to=2026-10-07',
    ],
    [
      'getCheckinStreakBuckets',
      () => getCheckinStreakBuckets(range),
      '/api/admin/stats/checkin/streak-buckets?from=2026-10-01&to=2026-10-07',
    ],
    [
      'getTasksSummary',
      () => getTasksSummary(range),
      '/api/admin/stats/tasks/summary?from=2026-10-01&to=2026-10-07',
    ],
    [
      'getTasksDaily',
      () => getTasksDaily(range),
      '/api/admin/stats/tasks/daily?from=2026-10-01&to=2026-10-07',
    ],
  ])('%s asks the right address and gives the items', async (_name, call, expected) => {
    const calls = stubFetch(() =>
      jsonResponse(200, envelope('200', { items: [{ statDate: '2026-10-01' }] })),
    );
    const result = (await call()) as { items: unknown[] };
    expect(calls[0].url).toBe(expected);
    expect(calls[0].init.method).toBe('GET');
    expect(calls[0].init.headers.Authorization).toBe('Bearer tok');
    expect(result.items).toHaveLength(1);
  });

  it('leaves out a platform or channel that is not chosen', async () => {
    const calls = stubFetch(() => jsonResponse(200, envelope('200', { items: [] })));
    await getDaily({ ...range, platform: undefined, channel: '' });
    expect(calls[0].url).toBe('/api/admin/stats/daily?from=2026-10-01&to=2026-10-07');
  });

  it('gives the guest quota as one object, not as items', async () => {
    const quota = { devices: 3, buckets: { ZERO: { devices: 1, converted: 0 } } };
    stubFetch(() => jsonResponse(200, envelope('200', quota)));
    expect(await getGuestQuota(range)).toEqual(quota);
  });

  it('keeps null columns as null', async () => {
    stubFetch(() =>
      jsonResponse(
        200,
        envelope('200', {
          items: [{ statDate: '2026-10-01', activeSubscriptions: null, d30: null }],
        }),
      ),
    );
    const { items } = await getDaily(range);
    expect(items[0].activeSubscriptions).toBeNull();
  });
});

describe('landStat', () => {
  it('posts the name and the day', async () => {
    const calls = stubFetch(() => jsonResponse(200, envelope('200', null)));
    await landStat('daily-event', '2026-10-20');
    expect(calls[0].url).toBe('/api/admin/stats/land/daily-event?date=2026-10-20');
    expect(calls[0].init.method).toBe('POST');
  });

  it('says whether the table of the reasons for no ad was left as it was', async () => {
    stubFetch(() => jsonResponse(200, envelope('200', { nofillSkipped: true })));
    expect(await landStat('ad-daily', '2026-10-01')).toEqual({ nofillSkipped: true });
    stubFetch(() => jsonResponse(200, envelope('200', { nofillSkipped: false })));
    expect(await landStat('ad-daily', '2026-10-20')).toEqual({ nofillSkipped: false });
    stubFetch(() => jsonResponse(200, envelope('200', null)));
    expect(await landStat('daily-event', '2026-10-20')).toEqual({ nofillSkipped: false });
    stubFetch(() => jsonResponse(200, envelope('200', { nofillSkipped: 'true' })));
    expect(await landStat('ad-daily', '2026-10-01')).toEqual({ nofillSkipped: false });
  });

  it('lists the sixteen names of the contract', () => {
    expect(LAND_NAMES).toHaveLength(16);
    expect(new Set(LAND_NAMES).size).toBe(16);
    expect(LAND_NAMES).toContain('checkin-daily');
    expect(LAND_NAMES).toContain('task-daily');
  });

  it('lets the backend refusal through', async () => {
    stubFetch(() => jsonResponse(403, envelope('ADMIN_FORBIDDEN')));
    await expect(landStat('push', '2026-10-20')).rejects.toMatchObject({ code: 'ADMIN_FORBIDDEN' });
  });
});

describe('fillMissingDays', () => {
  const zero = (statDate: string) => ({ statDate, n: 0 });

  it('adds the missing days as zero rows, ascending, each day once', () => {
    const rows = [
      { statDate: '2026-10-03', n: 5 },
      { statDate: '2026-10-01', n: 2 },
    ];
    expect(fillMissingDays(rows, '2026-10-01', '2026-10-04', zero)).toEqual([
      { statDate: '2026-10-01', n: 2 },
      { statDate: '2026-10-02', n: 0 },
      { statDate: '2026-10-03', n: 5 },
      { statDate: '2026-10-04', n: 0 },
    ]);
  });

  it('keeps the first row when a day is repeated, and drops rows outside the range', () => {
    const rows = [
      { statDate: '2026-10-02', n: 1 },
      { statDate: '2026-10-02', n: 9 },
      { statDate: '2026-09-30', n: 7 },
      { statDate: '2026-10-09', n: 7 },
    ];
    expect(fillMissingDays(rows, '2026-10-01', '2026-10-02', zero)).toEqual([
      { statDate: '2026-10-01', n: 0 },
      { statDate: '2026-10-02', n: 1 },
    ]);
  });

  it('is empty when from is after to, and one row for a single day', () => {
    expect(fillMissingDays([], '2026-10-05', '2026-10-01', zero)).toEqual([]);
    expect(fillMissingDays([], '2026-10-05', '2026-10-05', zero)).toEqual([
      { statDate: '2026-10-05', n: 0 },
    ]);
  });

  it('crosses a month and a year end and a leap day', () => {
    expect(fillMissingDays([], '2027-12-30', '2028-01-02', zero).map((r) => r.statDate)).toEqual([
      '2027-12-30',
      '2027-12-31',
      '2028-01-01',
      '2028-01-02',
    ]);
    expect(fillMissingDays([], '2028-02-28', '2028-03-01', zero).map((r) => r.statDate)).toEqual([
      '2028-02-28',
      '2028-02-29',
      '2028-03-01',
    ]);
  });
});

describe('getChannels', () => {
  const row = {
    channelCode: 'play',
    name: 'Android store',
    platform: 'ANDROID',
    distribution: 'STORE',
    packageName: 'x.y',
    enabled: true,
    createdAt: null,
  };

  it('reads items, or a bare list', async () => {
    stubFetch(() => jsonResponse(200, envelope('200', { items: [row] })));
    expect(await getChannels()).toEqual([row]);
    stubFetch(() => jsonResponse(200, envelope('200', [row])));
    expect(await getChannels()).toEqual([row]);
  });

  it('gives an empty list for an answer of another shape, and drops rows without a code', async () => {
    stubFetch(() => jsonResponse(200, envelope('200', { nothing: 1 })));
    expect(await getChannels()).toEqual([]);
    stubFetch(() =>
      jsonResponse(200, envelope('200', { items: [row, { name: 'no code' }, null] })),
    );
    expect(await getChannels()).toEqual([row]);
  });
});
