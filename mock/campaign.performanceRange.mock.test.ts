import { beforeEach, describe, expect, it } from 'vitest';
import { resetCampaignStore } from './_core/campaignData';
import type { MockReq, MockRes } from './_core/http';
import { issueToken, resetStore } from './_core/store';
import { adminOf, bearer, call } from './_core/testing';
import campaign from './campaign.mock';
import exportMock from './export.mock';

// The range errors of the performance report and of its export are those of every other
// statistics page (backend change request, row 268): `from` after `to` names `from`; a range over
// stats.max_range_days names `to`; a date that is not a day, or has a year below 1, is OUT_OF_RANGE.

beforeEach(() => {
  resetStore();
  resetCampaignStore(new Date('2026-10-26T10:00:00Z'));
});

type H = (req: MockReq, res: MockRes) => unknown;
const authorization = () => bearer(issueToken(adminOf('root')).token).authorization;
const report = (query: Record<string, string>) =>
  call((campaign as unknown as Record<string, H>)['GET /api/admin/attribution/performance'], {
    headers: { authorization: authorization() },
    query: { groupBy: 'day', ...query },
  });
const exported = async (query: Record<string, string>) => {
  let status = 0;
  let json: { code: string; message: string; data: { details: unknown[] } } | undefined;
  const res: MockRes = {
    status(code) {
      status = code;
      return res;
    },
    json(body) {
      json = body as typeof json;
      return undefined;
    },
    setHeader() {},
    end() {},
  };
  await (exportMock as unknown as Record<string, H>)['GET /api/admin/stats/export/:name'](
    {
      headers: { authorization: authorization() },
      query,
      params: { name: 'attribution-performance' },
      body: undefined,
    },
    res,
  );
  return { status, json };
};

const AFTER = { from: '2026-10-20', to: '2026-10-10' };
const TOO_LONG = { from: '2020-01-01', to: '2026-10-01' };

describe.each([
  [
    'the performance report',
    async (q: Record<string, string>) => {
      const { status, body } = await report(q);
      return { status, body };
    },
  ],
  [
    'its export',
    async (q: Record<string, string>) => {
      const { status, json } = await exported(q);
      return { status, body: json };
    },
  ],
])('%s', (_name, ask) => {
  it('names `from` with "from is after to" when the range is reversed', async () => {
    const { status, body } = await ask(AFTER);
    expect(status).toBe(400);
    expect(body?.code).toBe('INVALID_REQUEST');
    expect(body?.message).toBe('from is after to');
    expect(body?.data.details).toEqual([{ ref: 'from', reason: 'OUT_OF_RANGE' }]);
  });

  it('names `to` with "The range exceeds stats.max_range_days" when the range is too long', async () => {
    const { status, body } = await ask(TOO_LONG);
    expect(status).toBe(400);
    expect(body?.message).toBe('The range exceeds stats.max_range_days');
    expect(body?.data.details).toEqual([{ ref: 'to', reason: 'OUT_OF_RANGE' }]);
  });

  it.each([
    ['text', 'x'],
    ['an impossible day', '2026-02-30'],
    ['a slash date', '2026/01/01'],
    ['year 0', '0000-01-01'],
  ])('answers OUT_OF_RANGE, never INVALID_FORMAT, for %s', async (_label, bad) => {
    const first = await ask({ from: bad, to: '2026-10-10' });
    expect(first.status).toBe(400);
    expect(first.body?.data.details).toEqual([{ ref: 'from', reason: 'OUT_OF_RANGE' }]);
    const second = await ask({ from: '2026-10-01', to: bad });
    expect(second.body?.data.details).toEqual([{ ref: 'to', reason: 'OUT_OF_RANGE' }]);
    expect(JSON.stringify(first.body)).not.toContain('INVALID_FORMAT');
  });

  it('accepts a range of exactly the longest length', async () => {
    const { status } = await ask({ from: '2025-10-01', to: '2026-10-01' });
    expect(status).toBe(200);
  });
});
