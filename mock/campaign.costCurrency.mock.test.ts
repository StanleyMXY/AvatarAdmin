import { beforeEach, describe, expect, it } from 'vitest';
import { campaignState, resetCampaignStore } from './_core/campaignData';
import { resetConfigStore, saved } from './_core/configStore';
import { issueToken, resetStore } from './_core/store';
import { adminOf, bearer, call } from './_core/testing';
import campaign from './campaign.mock';
import config from './config.mock';

const NOW = new Date('2026-10-26T10:00:00Z');

beforeEach(() => {
  resetStore();
  resetConfigStore();
  resetCampaignStore(NOW);
});

type H = Parameters<typeof call>[0];
const h = (name: string) => (campaign as unknown as Record<string, H>)[name];
const token = (user: string) => bearer(issueToken(adminOf(user)).token).authorization;
const send = (name: string, body: unknown, params = {}, user = 'root') =>
  call(h(name), { headers: { authorization: token(user) }, body, params });

const COST_CREATE = 'POST /api/admin/attribution/costs';
const COST_DELETE = 'DELETE /api/admin/attribution/costs/:id';
const BATCH = 'POST /api/admin/attribution/costs/batch';

const costBody = (over: Record<string, unknown> = {}) => ({
  campaignId: '1',
  statDate: '2026-10-01',
  amount: 10.5,
  currency: 'USD',
  remark: null,
  ...over,
});

const batchRow = (over: Record<string, unknown> = {}) => ({
  campaignCode: 'spring_th',
  statDate: '2026-09-01',
  amount: 5,
  currency: 'USD',
  remark: null,
  ...over,
});

const refs = (body: { data: { details?: { ref: string; reason: string }[] } }) =>
  (body.data.details ?? []).map((d) => `${d.ref}:${d.reason}`);

describe('the currency of the costs is locked while a cost row exists', () => {
  const CONFIG_SAVE = 'PUT /api/admin/config/:key';
  const CONFIG_RESET = 'DELETE /api/admin/config/:key';
  const KEY = 'attribution.cost_currency';
  const hc = (name: string) => (config as unknown as Record<string, H>)[name];
  const save = (value: unknown) =>
    call(hc(CONFIG_SAVE), {
      headers: { authorization: token('root') },
      params: { key: KEY },
      body: { value },
    });
  const reset = () =>
    call(hc(CONFIG_RESET), { headers: { authorization: token('root') }, params: { key: KEY } });
  const setEur = () =>
    saved.set(KEY, { value: 'EUR', updatedAt: '', updatedBy: '', updatedByUsername: '' });

  it('refuses a different currency with INVALID_REQUEST naming attribution.cost_currency, and stores nothing', async () => {
    expect(campaignState.costs.length).toBeGreaterThan(0);
    const refused = await save('EUR');
    expect(refused.status).toBe(400);
    expect(refused.body.code).toBe('INVALID_REQUEST');
    expect(refused.body.data.details).toEqual([{ ref: KEY, reason: 'OUT_OF_RANGE' }]);
    expect(refused.body.message).toBe(
      `${KEY} cannot be changed from USD to EUR because cost rows exist (one currency is used for all cost rows)`,
    );
    expect(saved.has(KEY)).toBe(false);
  });

  it('lets the same currency be saved again', async () => {
    expect((await save('USD')).status).toBe(200);
    setEur();
    expect((await save('EUR')).status).toBe(200);
  });

  it('refuses a reset to the default USD while the value is another one, and accepts it when the value is USD already', async () => {
    setEur();
    const refused = await reset();
    expect(refused.status).toBe(400);
    expect(refused.body.data.details).toEqual([{ ref: KEY, reason: 'OUT_OF_RANGE' }]);
    expect(saved.get(KEY)?.value).toBe('EUR');
    saved.delete(KEY);
    expect((await reset()).status).toBe(200);
  });

  it('lets the currency change once the last cost row is deleted, and then asks the new currency of every cost', async () => {
    for (const cost of [...campaignState.costs]) {
      expect((await send(COST_DELETE, undefined, { id: cost.id })).status).toBe(200);
    }
    expect((await save('EUR')).status).toBe(200);
    expect((await send(COST_CREATE, costBody())).status).toBe(400);
    expect((await send(COST_CREATE, costBody({ currency: 'EUR' }))).status).toBe(200);
    expect(refs((await save('THB')).body as never)).toEqual([`${KEY}:OUT_OF_RANGE`]);
  });

  it('asks every row of a batch to be in the currency of the setting, also after a change', async () => {
    for (const cost of [...campaignState.costs])
      await send(COST_DELETE, undefined, { id: cost.id });
    expect((await save('EUR')).status).toBe(200);
    const wrong = await send(BATCH, [batchRow({ currency: 'USD' })]);
    expect(wrong.status).toBe(400);
    expect(refs(wrong.body as never)).toEqual(['0.currency:OUT_OF_RANGE']);
    expect((await send(BATCH, [batchRow({ currency: 'EUR' })])).status).toBe(200);
  });
});
