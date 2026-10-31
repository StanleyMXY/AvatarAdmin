import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { resetSessionState, setToken } from '../../request/session';
import {
  createChannel,
  createTemplate,
  deleteChannel,
  deleteTemplate,
  getChannel,
  getSmsMeta,
  listChannels,
  listRecords,
  listTemplates,
  loadAllPages,
  SMS_RECORDS_EXPORT_URL,
  sendTestSms,
  setChannelEnabled,
  setTemplateEnabled,
  updateChannel,
  updateTemplate,
} from './index';

beforeEach(() => {
  resetSessionState();
  sessionStorage.clear();
  setToken('tok');
});
afterEach(() => vi.unstubAllGlobals());

const answer = (data: unknown) => stubFetch(() => jsonResponse(200, envelope('200', data)));
const body = (call: { init: RequestInit }) => JSON.parse(call.init.body as string);
const query = (call: { url: string }) =>
  Object.fromEntries(new URL(call.url, 'http://x').searchParams);

describe('the channels', () => {
  it('lists with the paging and reads one by its id', async () => {
    const calls = answer({ items: [{ id: '1' }], total: 1 });
    expect(await listChannels({ page: 2, pageSize: 50 })).toEqual({
      items: [{ id: '1' }],
      total: 1,
    });
    expect(new URL(calls[0].url, 'http://x').pathname).toBe('/api/admin/sms/channels');
    expect(query(calls[0])).toEqual({ page: '2', pageSize: '50' });
    await getChannel('a/b');
    expect(new URL(calls[1].url, 'http://x').pathname).toBe('/api/admin/sms/channels/a%2Fb');
  });

  it('reads a bare list or an answer without a list as a page, never as a crash', async () => {
    answer([{ id: '1' }]);
    expect(await listChannels({ page: 1, pageSize: 20 })).toEqual({
      items: [{ id: '1' }],
      total: 1,
    });
    answer({ items: 'nope', total: 'x' });
    expect(await listChannels({ page: 1, pageSize: 20 })).toEqual({ items: [], total: 0 });
    answer(null);
    expect(await listChannels({ page: 1, pageSize: 20 })).toEqual({ items: [], total: 0 });
  });

  it('creates with POST and updates with PUT, and sends exactly the body it is given', async () => {
    const calls = answer({ id: '9' });
    const input = {
      channelCode: 'gw_th',
      name: 'n',
      providerCode: 'gateway-a',
      apiUrl: 'https://sms.example.com/v1',
      extConfig: { appId: 'x' },
      countries: ['TH'],
      smsType: 'OTP' as const,
      priority: 10,
      enabled: false,
      credentials: { apiKey: 'typed-secret', ผู้ใช้: 'ñandú' },
    };
    await createChannel(input);
    expect([calls[0].init.method, new URL(calls[0].url, 'http://x').pathname]).toEqual([
      'POST',
      '/api/admin/sms/channels',
    ]);
    expect(body(calls[0])).toEqual(input);
    const { channelCode: _code, enabled: _enabled, ...patch } = input;
    await updateChannel('9', patch);
    expect([calls[1].init.method, new URL(calls[1].url, 'http://x').pathname]).toEqual([
      'PUT',
      '/api/admin/sms/channels/9',
    ]);
    expect(body(calls[1])).toEqual(patch);
  });

  it('does not add a credentials key to an update that has none', async () => {
    const calls = answer({});
    await updateChannel('9', {
      name: 'n',
      providerCode: 'gateway-a',
      apiUrl: 'https://sms.example.com/v1',
      extConfig: null,
      countries: [],
      smsType: 'OTP',
      priority: 1,
    });
    expect('credentials' in body(calls[0])).toBe(false);
  });

  it('switches with PUT …/enabled, deletes with DELETE, and test-sends to the number it is given', async () => {
    const calls = answer({});
    await setChannelEnabled('9', false);
    expect([calls[0].init.method, new URL(calls[0].url, 'http://x').pathname]).toEqual([
      'PUT',
      '/api/admin/sms/channels/9/enabled',
    ]);
    expect(body(calls[0])).toEqual({ enabled: false });
    await deleteChannel('9');
    expect([calls[1].init.method, new URL(calls[1].url, 'http://x').pathname]).toEqual([
      'DELETE',
      '/api/admin/sms/channels/9',
    ]);
    await sendTestSms('9', '+66812345678');
    expect([calls[2].init.method, new URL(calls[2].url, 'http://x').pathname]).toEqual([
      'POST',
      '/api/admin/sms/channels/9/test',
    ]);
    expect(body(calls[2])).toEqual({ mobile: '+66812345678' });
  });
});

describe('the meta of the channels', () => {
  it('reads the providers with their hosts and the number of test sends left today', async () => {
    answer({
      providers: [{ code: 'gateway-a', allowedHosts: ['sms.example.com'] }],
      testRemainingToday: 3,
    });
    expect(await getSmsMeta()).toEqual({
      providers: [{ code: 'gateway-a', allowedHosts: ['sms.example.com'] }],
      testRemainingToday: 3,
    });
  });

  it('keeps what it can read of a strange answer: no number is made up, a number below zero is none', async () => {
    answer({
      providers: [
        { code: 5 },
        { code: 'ok', allowedHosts: 'x' },
        null,
        { code: 'b', allowedHosts: ['h', 2] },
      ],
      testRemainingToday: -2,
    });
    expect(await getSmsMeta()).toEqual({
      providers: [
        { code: 'ok', allowedHosts: [] },
        { code: 'b', allowedHosts: ['h'] },
      ],
      testRemainingToday: null,
    });
    answer(null);
    expect(await getSmsMeta()).toEqual({ providers: [], testRemainingToday: null });
    answer({ providers: [], testRemainingToday: 2.9 });
    expect((await getSmsMeta()).testRemainingToday).toBe(2);
  });
});

describe('the templates', () => {
  it('lists, creates, updates, switches and deletes at /sms/templates', async () => {
    const calls = answer({ items: [], total: 0 });
    await listTemplates({ page: 1, pageSize: 20 });
    expect(new URL(calls[0].url, 'http://x').pathname).toBe('/api/admin/sms/templates');
    const input = {
      templateCode: 'otp_en',
      name: 'n',
      smsType: 'OTP' as const,
      locale: 'en',
      country: null,
      content: 'Your code is {code}',
      providerTemplateId: null,
      enabled: true,
    };
    await createTemplate(input);
    expect(calls[1].init.method).toBe('POST');
    expect(body(calls[1])).toEqual(input);
    const { templateCode: _c, enabled: _e, ...patch } = input;
    await updateTemplate('4', patch);
    expect([calls[2].init.method, new URL(calls[2].url, 'http://x').pathname]).toEqual([
      'PUT',
      '/api/admin/sms/templates/4',
    ]);
    await setTemplateEnabled('4', true);
    expect(new URL(calls[3].url, 'http://x').pathname).toBe('/api/admin/sms/templates/4/enabled');
    expect(body(calls[3])).toEqual({ enabled: true });
    await deleteTemplate('4');
    expect(calls[4].init.method).toBe('DELETE');
  });
});

describe('the records', () => {
  it('sends only the filters that were asked for, under the names of the record', async () => {
    const calls = answer({ items: [], total: 0 });
    await listRecords({ page: 1, pageSize: 20 });
    expect(query(calls[0])).toEqual({ page: '1', pageSize: '20' });
    await listRecords({
      page: 2,
      pageSize: 50,
      msgId: 'm1',
      vendorMsgId: 'v1',
      mobile: '+66812345678',
      channel: 'PUSH',
      channelCode: 'push',
      purpose: 'LOGIN',
      sendStatus: 'SUCCESS',
      deliveryStatus: 'DELIVERED',
      used: true,
      from: '2026-10-20T00:00:00Z',
      to: '2026-10-27T00:00:00Z',
    });
    expect(query(calls[1])).toEqual({
      page: '2',
      pageSize: '50',
      msgId: 'm1',
      vendorMsgId: 'v1',
      mobile: '+66812345678',
      channel: 'PUSH',
      channelCode: 'push',
      purpose: 'LOGIN',
      sendStatus: 'SUCCESS',
      deliveryStatus: 'DELIVERED',
      used: 'true',
      from: '2026-10-20T00:00:00Z',
      to: '2026-10-27T00:00:00Z',
    });
    expect(new URL(calls[1].url, 'http://x').pathname).toBe('/api/admin/sms/records');
  });

  it('exports from /sms/records/export', () => {
    expect(SMS_RECORDS_EXPORT_URL).toBe('/sms/records/export');
  });
});

describe('loadAllPages', () => {
  it('reads page after page until all rows are there, and stops at an empty page', async () => {
    const pages: number[] = [];
    const rows = await loadAllPages(async (page) => {
      pages.push(page);
      return page < 3 ? { items: [page, page], total: 99 } : { items: [], total: 99 };
    });
    expect(rows).toEqual([1, 1, 2, 2]);
    expect(pages).toEqual([1, 2, 3]);
  });
});
