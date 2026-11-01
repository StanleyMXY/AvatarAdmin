import { beforeEach, describe, expect, it } from 'vitest';
import { resetConfigStore } from './_core/configStore';
import { resetSmsStore, smsState } from './_core/smsData';
import { issueToken, resetStore } from './_core/store';
import { adminOf, bearer, call } from './_core/testing';
import auth from './auth.mock';
import config from './config.mock';

beforeEach(() => {
  resetStore();
  resetConfigStore();
  resetSmsStore();
});

type H = Parameters<typeof call>[0];
const h = (name: string) => (config as unknown as Record<string, H>)[name];
const token = () => bearer(issueToken(adminOf('root')).token).authorization;
const put = (key: string, value: unknown) =>
  call(h('PUT /api/admin/config/:key'), {
    headers: { authorization: token() },
    params: { key },
    body: { value },
  });
const del = (key: string) =>
  call(h('DELETE /api/admin/config/:key'), {
    headers: { authorization: token() },
    params: { key },
  });
const meta = () =>
  call((auth as unknown as Record<string, H>)['GET /api/admin/meta'], {
    headers: { authorization: token() },
  });

const refs = (body: { data: { details: { ref: string; reason: string }[] } }) =>
  body.data.details.map((d) => `${d.ref}:${d.reason}`);

describe('the numbers and texts that the contract gives a range', () => {
  it('refuses a face score outside 0.1 to 1, a mouth area of 0 or less, a brightness outside 0 to 255', async () => {
    for (const [key, bad, good] of [
      ['moderation.face_min_det_score', 0.09, 0.1],
      ['moderation.face_min_det_score', 1.01, 1],
      ['generation.mouth_open_min_area', 0, 0.035],
      ['generation.mouth_open_min_brightness', -1, 0],
      ['generation.mouth_open_min_brightness', 256, 255],
    ] as const) {
      const refused = await put(key, bad);
      expect(refused.status, `${key} ${bad}`).toBe(400);
      expect(refs(refused.body)).toEqual([`${key}:OUT_OF_RANGE`]);
      expect((await put(key, good)).status, `${key} ${good}`).toBe(200);
    }
  });

  it('refuses an app name that is empty once trimmed or longer than 100 characters, and a reward trigger that is neither of the two', async () => {
    expect((await put('app.display_name', '   ')).status).toBe(400);
    expect((await put('app.display_name', 'a'.repeat(101))).status).toBe(400);
    expect((await put('app.display_name', 'แอปอวตาร ✨')).status).toBe(200);
    expect(refs((await put('invite.reward_trigger', 'SIGNUP')).body)).toEqual([
      'invite.reward_trigger:OUT_OF_RANGE',
    ]);
    expect((await put('invite.reward_trigger', 'REGISTER')).status).toBe(200);
    expect((await put('invite.reward_trigger', 'FIRST_CALL')).status).toBe(200);
  });
});

describe('the start of the invite reward must be earlier than its end (contract 17.5)', () => {
  it('refuses a start that is not earlier than the end, naming both keys with the saved one first', async () => {
    expect((await put('invite.reward_end_at', '2026-11-30T00:00:00Z')).status).toBe(200);
    const late = await put('invite.reward_start_at', '2026-12-01T00:00:00Z');
    expect(late.status).toBe(400);
    expect(refs(late.body)).toEqual([
      'invite.reward_start_at:OUT_OF_RANGE',
      'invite.reward_end_at:OUT_OF_RANGE',
    ]);
    const equal = await put('invite.reward_start_at', '2026-11-30T00:00:00Z');
    expect(equal.status).toBe(400);
    expect((await put('invite.reward_start_at', '2026-11-01T00:00:00Z')).status).toBe(200);
  });

  it('judges the end against the start in the same way, in any zone it is written in', async () => {
    expect((await put('invite.reward_start_at', '2026-11-30T10:00:00Z')).status).toBe(200);
    const early = await put('invite.reward_end_at', '2026-11-30T12:00:00+05:00'); // 07:00 UTC
    expect(early.status).toBe(400);
    expect(refs(early.body)).toEqual([
      'invite.reward_end_at:OUT_OF_RANGE',
      'invite.reward_start_at:OUT_OF_RANGE',
    ]);
    expect((await put('invite.reward_end_at', '2026-11-30T12:00:00-05:00')).status).toBe(200);
  });

  it('asks nothing of one that is empty or not yet set', async () => {
    expect((await put('invite.reward_start_at', '2030-01-01T00:00:00Z')).status).toBe(200);
    expect((await del('invite.reward_end_at')).status).toBe(200);
  });
});

describe('a saved list of countries that no enabled channel covers (contract 17.4, SMS_COUNTRY_UNCOVERED)', () => {
  it('saves it, and says in a warning which countries are not covered', async () => {
    const { status, body } = await put('sms.allowed_country_codes', ['TH', 'JP', 'BR']);
    expect(status).toBe(200);
    expect(body.data.warnings).toEqual([
      expect.objectContaining({
        code: 'SMS_COUNTRY_UNCOVERED',
        message: expect.stringContaining('JP, BR'),
      }),
    ]);
    expect(body.data.warnings[0].message).not.toContain('TH');
  });

  it('says nothing when every country is covered by an enabled channel', async () => {
    const { body } = await put('sms.allowed_country_codes', ['TH', 'ID', 'VN']);
    expect(body.data.warnings).toEqual([]);
  });

  it('counts a channel with no countries as serving every country, once it is enabled', async () => {
    for (const channel of smsState.channels.values()) {
      if (channel.countries.length === 0 && channel.smsType === 'OTP') channel.enabled = true;
    }
    const { body } = await put('sms.allowed_country_codes', ['TH', 'JP', 'BR']);
    expect(body.data.warnings).toEqual([]);
  });

  it('does not count a channel that is not for one-time codes', async () => {
    for (const channel of smsState.channels.values()) {
      if (channel.smsType === 'MARKETING') channel.enabled = true;
    }
    const { body } = await put('sms.allowed_country_codes', ['JP']);
    expect(body.data.warnings.map((w: { code: string }) => w.code)).toEqual([
      'SMS_COUNTRY_UNCOVERED',
    ]);
  });

  it('does not count a disabled channel', async () => {
    for (const channel of smsState.channels.values()) {
      if (channel.countries.includes('TH')) channel.enabled = false;
    }
    const { body } = await put('sms.allowed_country_codes', ['TH']);
    expect(body.data.warnings.map((w: { code: string }) => w.code)).toEqual([
      'SMS_COUNTRY_UNCOVERED',
    ]);
  });
});

describe('GET /meta follows the settings it repeats', () => {
  it('gives the languages, the longest report range and the currencies as they are saved, and the defaults again after a reset', async () => {
    const before = (await meta()).body.data;
    expect(before.statsMaxRangeDays).toBe(366);
    expect((await put('stats.max_range_days', 30)).status).toBe(200);
    expect((await put('app.supported_locales', ['en'])).status).toBe(200);
    expect((await put('invite.chain_max_depth', 3)).status).toBe(200);
    const after = (await meta()).body.data;
    expect(after.statsMaxRangeDays).toBe(30);
    expect(after.supportedLocales).toEqual(['en']);
    expect(after.inviteChainMaxDepth).toBe(3);
    await del('stats.max_range_days');
    await del('invite.chain_max_depth');
    const reset = (await meta()).body.data;
    expect(reset.statsMaxRangeDays).toBe(366);
    expect(reset.inviteChainMaxDepth).toBe(5);
  });

  it('keeps the seven languages of the fake meta until someone saves the language list', async () => {
    expect((await meta()).body.data.supportedLocales).toEqual([
      'en',
      'zh-Hans',
      'th',
      'ar',
      'id',
      'vi',
      'es',
    ]);
  });

  it('does not let a changed answer reach the next one (a copy each time)', async () => {
    const first = (await meta()).body.data;
    first.supportedLocales.push('xx');
    expect((await meta()).body.data.supportedLocales).not.toContain('xx');
  });
});
