import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import configMock from '../../../mock/config.mock';
import smsMock from '../../../mock/sms.mock';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import RecordsPage from './records';
import {
  chooseOption,
  jsonAnswer,
  NOW,
  overrideFetch,
  settled,
  sheetAnswer,
  signIn,
  smsState,
} from './testSetup';

const backend = () => useMockBackend({ default: smsMock }, { default: configMock });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  (URL as unknown as { createObjectURL: unknown }).createObjectURL = vi.fn(() => 'blob:x');
  (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  signIn('root');
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const rows = () => [...document.querySelectorAll('.ant-table-tbody tr.ant-table-row')];
const cellsOf = (tr: Element) => [...tr.querySelectorAll('td')].map((td) => td.textContent ?? '');
const user = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
const load = async (codes?: string[]) => {
  if (codes) signIn('support', { codes });
  const calls = backend();
  const u = user();
  renderPage(<RecordsPage />);
  await waitFor(() => expect(rows().length).toBeGreaterThan(0));
  return { calls, user: u };
};
const exportButton = () =>
  [...document.querySelectorAll('button')].find((b) => b.textContent === 'Export') ?? null;
const listCalls = (calls: { method: string; url: string }[]) =>
  calls
    .filter(
      (c) =>
        c.method === 'GET' &&
        c.url.startsWith('/api/admin/sms/records') &&
        !c.url.includes('/export'),
    )
    .map((c) => new URL(c.url, 'http://x').searchParams);
const headers = () =>
  [...document.querySelectorAll('.ant-table-thead th')].map((th) => th.textContent);
const columnOf = (name: string) => headers().indexOf(name);
const textBox = (name: string) => screen.getByRole('textbox', { name });
const setText = (input: HTMLElement, value: string) =>
  fireEvent.change(input, { target: { value } });
const record = (i: number) => smsState.records[i];

describe('the list of send records', () => {
  it('shows the columns of the spec and a page of the records, newest first', async () => {
    await load();
    expect(headers()).toEqual([
      'Message ID',
      'Provider message ID',
      'Phone number',
      'Country',
      'Purpose',
      'Delivery channel',
      'Channel',
      'Send status',
      'Delivery status',
      'Used',
      'Failure reason',
      'Content',
      'Created',
      'Sent',
    ]);
    expect(rows()).toHaveLength(20);
    const first = cellsOf(rows()[0]);
    expect(first[columnOf('Message ID')]).toBe(record(0).msgId);
    expect(first[columnOf('Country')]).toBe(record(0).country);
    expect(first[columnOf('Content')]).toBe(record(0).contentRedacted);
  });

  it('shows the text with the code already replaced by **** and no way to see a code', async () => {
    await load();
    expect(screen.getAllByText(/\*\*\*\*/).length).toBeGreaterThan(5);
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(
      /view (the )?(verification )?code|show (the )?code|reveal|查看验证码/i,
    );
    // The text of a message can say "code"; nothing that can be pressed offers to show one.
    const offer = /\b(view|show|reveal|display|see|get|look)\b.*\bcode/i;
    expect(screen.queryByRole('button', { name: offer })).toBeNull();
    expect(screen.queryByRole('link', { name: offer })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: offer })).toBeNull();
  });

  it('shows the number as the backend gives it: masked to the last four digits, with a note on how to see it whole', async () => {
    await load(['SMS:RECORD']);
    const mobiles = rows().map((tr) => cellsOf(tr)[columnOf('Phone number')]);
    expect(mobiles.every((m) => /^\*{4}\d{4}$/.test(m))).toBe(true);
    expect(mobiles[0]).toBe(`****${record(0).mobile.slice(-4)}`);
    expect(screen.getByText(/Numbers are masked/)).toBeInTheDocument();
    expect(screen.getByText(/Needs the .* permission to see the full value/)).toBeInTheDocument();
  });

  it('shows the whole number, and no note, to an administrator with SMS:RECORD:PHONE_VIEW', async () => {
    await load(['SMS:RECORD', 'SMS:RECORD:PHONE_VIEW']);
    expect(cellsOf(rows()[0])[columnOf('Phone number')]).toBe(record(0).mobile);
    expect(screen.queryByText(/Numbers are masked/)).toBeNull();
  });

  it('never makes a number whole or masks it itself: what comes is what is shown', async () => {
    backend();
    overrideFetch(async ({ url, method }) =>
      method === 'GET' && url.pathname === '/api/admin/sms/records'
        ? jsonAnswer(200, '200', {
            items: [
              { ...record(0), mobile: '+66*****5678' },
              { ...record(1), mobile: '+66812345678' },
              { ...record(2), mobile: { not: 'text' } },
            ],
            total: 3,
          })
        : undefined,
    );
    renderPage(<RecordsPage />);
    await waitFor(() => expect(rows().length).toBe(3));
    const mobiles = rows().map((tr) => cellsOf(tr)[columnOf('Phone number')]);
    expect(mobiles).toEqual(['+66*****5678', '+66812345678', '{"not":"text"}']);
  });

  it('shows a dash for the provider message ID and the delivery status of a row that went out as a push, whatever the backend sent', async () => {
    backend();
    const push = smsState.records.find((r) => r.channel === 'PUSH');
    if (!push) throw new Error('no push record in the sample data');
    overrideFetch(async ({ url, method }) =>
      method === 'GET' && url.pathname === '/api/admin/sms/records'
        ? jsonAnswer(200, '200', {
            items: [
              { ...push, vendorMsgId: 'V-SHOULD-NOT-SHOW', deliveryStatus: 'DELIVERED' },
              record(0).channel === 'SMS' ? record(0) : { ...record(1) },
            ],
            total: 2,
          })
        : undefined,
    );
    renderPage(<RecordsPage />);
    await waitFor(() => expect(rows().length).toBe(2));
    const cells = cellsOf(rows()[0]);
    expect(cells[columnOf('Delivery channel')]).toBe('Push');
    expect(cells[columnOf('Provider message ID')]).toBe('—');
    expect(cells[columnOf('Delivery status')]).toBe('—');
    expect(document.body.textContent).not.toContain('V-SHOULD-NOT-SHOW');
    expect(cellsOf(rows()[1])[columnOf('Delivery channel')]).toBe('SMS');
    expect(cellsOf(rows()[1])[columnOf('Provider message ID')]).not.toBe('—');
  });

  it('shows when the code was used, and that it was not', async () => {
    await load();
    const used = rows().filter((tr) => cellsOf(tr)[columnOf('Used')] !== 'Not used');
    const unused = rows().filter((tr) => cellsOf(tr)[columnOf('Used')] === 'Not used');
    expect(used.length).toBeGreaterThan(0);
    expect(unused.length).toBeGreaterThan(0);
    expect(cellsOf(used[0])[columnOf('Used')]).toMatch(/2026/);
  });

  it('lets a failure reason or a content of 5000 letters without a space break anywhere', async () => {
    await load();
    const failed = smsState.records.slice(0, 20).find((r) => r.failReason === 'E'.repeat(5000));
    expect(failed).toBeTruthy();
    const long = screen.getByText('E'.repeat(5000));
    expect((long.closest('button') as HTMLElement).style.overflowWrap).toBe('anywhere');
    const thai = screen.getByText(`${record(7).contentRedacted}`);
    expect((thai.closest('button') as HTMLElement).style.overflowWrap).toBe('anywhere');
  });

  it('draws what it is given even when the values are not what the contract says', async () => {
    backend();
    overrideFetch(async ({ url, method }) =>
      method === 'GET' && url.pathname === '/api/admin/sms/records'
        ? jsonAnswer(200, '200', {
            items: [
              {
                msgId: 5,
                channel: 'FAX',
                purpose: ['x'],
                sendStatus: null,
                deliveryStatus: 7,
                failReason: { a: 1 },
                contentRedacted: 42,
                usedAt: 'not a time',
                createdAt: 9,
              },
              null,
            ],
            total: 2,
          })
        : undefined,
    );
    renderPage(<RecordsPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    expect(document.body.textContent).toContain('FAX');
    expect(document.body.textContent).toContain('"a":1');
  });

  it('says what went wrong in the words of the code, with a button to read again', async () => {
    backend();
    let fail = true;
    overrideFetch(async ({ url, method }) =>
      fail && method === 'GET' && url.pathname === '/api/admin/sms/records'
        ? jsonAnswer(500, 'INTERNAL_ERROR', null, 'SECRET BACKEND WORDS')
        : undefined,
    );
    const u = user();
    renderPage(<RecordsPage />);
    expect(await screen.findByText(/Failed to load/)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('SECRET BACKEND WORDS');
    fail = false;
    await u.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
  });

  it('keeps the answer of the newest read when an older one arrives late', async () => {
    backend();
    let reads = 0;
    let letOldGo: () => void = () => {};
    overrideFetch(async ({ url, method }) => {
      if (method !== 'GET' || url.pathname !== '/api/admin/sms/records') return undefined;
      reads += 1;
      if (reads !== 2) return undefined;
      await new Promise<void>((resolve) => {
        letOldGo = resolve;
      });
      return jsonAnswer(200, '200', { items: [{ ...record(0), msgId: 'OLD_ANSWER' }], total: 1 });
    });
    const u = user();
    renderPage(<RecordsPage />);
    await waitFor(() => expect(rows().length).toBe(20));
    await u.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(reads).toBe(2));
    await u.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(reads).toBe(3));
    letOldGo();
    await settled();
    expect(document.body.textContent).not.toContain('OLD_ANSWER');
    expect(rows().length).toBe(20);
  });
});

describe('the filters', () => {
  it('read the last seven UTC days at first, and say that the days are UTC', async () => {
    const { calls } = await load();
    const first = listCalls(calls)[0];
    expect(first.get('from')).toBe('2026-10-20T00:00:00Z');
    expect(first.get('to')).toBe('2026-10-27T00:00:00Z');
    expect(first.get('page')).toBe('1');
    expect(first.get('pageSize')).toBe('20');
    for (const name of [
      'msgId',
      'vendorMsgId',
      'mobile',
      'channel',
      'channelCode',
      'purpose',
      'sendStatus',
      'deliveryStatus',
      'used',
    ]) {
      expect(first.has(name), name).toBe(false);
    }
    expect(screen.getByText(/UTC/)).toBeInTheDocument();
  });

  it('send only what was asked for when Search is pressed, cut at the ends, and nothing before', async () => {
    const { calls, user: u } = await load();
    const before = listCalls(calls).length;
    setText(textBox('Message ID'), '  m-1 ');
    setText(textBox('Provider message ID'), 'V-70000');
    setText(textBox('Phone number'), ' +66812345678 ');
    setText(textBox('Channel'), 'gw_th_otp');
    await chooseOption(u, 'Delivery channel', 'Push');
    await chooseOption(u, 'Purpose', 'Login');
    await chooseOption(u, 'Send status', 'Failed');
    await chooseOption(u, 'Delivery status', 'Delivered');
    await chooseOption(u, 'Used', 'Used');
    await settled();
    expect(listCalls(calls)).toHaveLength(before);
    await u.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(listCalls(calls)).toHaveLength(before + 1));
    const sent = Object.fromEntries(listCalls(calls)[before]);
    expect(sent).toMatchObject({
      page: '1',
      msgId: 'm-1',
      vendorMsgId: 'V-70000',
      mobile: '+66812345678',
      channelCode: 'gw_th_otp',
      channel: 'PUSH',
      purpose: 'LOGIN',
      sendStatus: 'FAILED',
      deliveryStatus: 'DELIVERED',
      used: 'true',
    });
  });

  it('send "not used" as false, not as nothing', async () => {
    const { calls, user: u } = await load();
    await chooseOption(u, 'Used', 'Not used');
    await u.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(listCalls(calls).some((p) => p.get('used') === 'false')).toBe(true));
    const rowsNow = rows();
    expect(rowsNow.every((tr) => cellsOf(tr)[columnOf('Used')] === 'Not used')).toBe(true);
  });

  it('match the whole number only: the hint says so, and a part of a number finds nothing', async () => {
    const { user: u } = await load(['SMS:RECORD', 'SMS:RECORD:PHONE_VIEW']);
    expect(screen.getByText(/whole number.*exactly/i)).toBeInTheDocument();
    const target = record(0).mobile;
    setText(textBox('Phone number'), target.slice(0, -1));
    await u.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(screen.getByText('No records')).toBeInTheDocument());
    setText(textBox('Phone number'), target);
    await u.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    expect(rows().every((tr) => cellsOf(tr)[columnOf('Phone number')] === target)).toBe(true);
  });

  it('read again from page 1 when Search is pressed with the same filters', async () => {
    const { calls, user: u } = await load();
    const before = listCalls(calls).length;
    await u.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(listCalls(calls)).toHaveLength(before + 1));
  });

  it('go to the next page with the filters of the last search', async () => {
    const { calls, user: u } = await load();
    await chooseOption(u, 'Delivery channel', 'SMS');
    await u.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() =>
      expect(listCalls(calls).some((p) => p.get('channel') === 'SMS')).toBe(true),
    );
    await u.click(await screen.findByTitle('2'));
    await waitFor(() => expect(listCalls(calls).some((p) => p.get('page') === '2')).toBe(true));
    const second = listCalls(calls).find((p) => p.get('page') === '2') as URLSearchParams;
    expect(second.get('channel')).toBe('SMS');
  });
});

describe('the export', () => {
  it('has no button without SMS:RECORD:EXPORT', async () => {
    await load(['SMS:RECORD', 'SMS:RECORD:PHONE_VIEW']);
    expect(exportButton()).toBeNull();
  });

  it('has a button with SMS:RECORD:EXPORT', async () => {
    await load(['SMS:RECORD', 'SMS:RECORD:EXPORT']);
    expect(exportButton()).not.toBeNull();
  });

  it('has no button for SMS:RECORD:EXPORT without SMS:RECORD: the export needs both', async () => {
    signIn('support', { codes: ['SMS:RECORD:EXPORT'] });
    backend();
    renderPage(<RecordsPage />);
    await screen.findByText(/Failed to load/);
    expect(exportButton()).toBeNull();
  });

  it('asks /sms/records/export with the filters of the last search, not those only typed, and saves the file', async () => {
    signIn('support', { codes: ['SMS:RECORD', 'SMS:RECORD:EXPORT'] });
    backend();
    const taken = overrideFetch(({ url }) =>
      url.pathname === '/api/admin/sms/records/export'
        ? sheetAnswer('sms-records-2026-10-20-2026-10-26')
        : undefined,
    );
    const u = user();
    renderPage(<RecordsPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    await chooseOption(u, 'Delivery channel', 'Push');
    // chosen, not searched: not in the export
    await u.click(exportButton() as HTMLElement);
    await waitFor(() => expect(taken).toHaveLength(1));
    const first = new URL(taken[0].url, 'http://x');
    expect(first.pathname).toBe('/api/admin/sms/records/export');
    expect(first.searchParams.get('from')).toBe('2026-10-20T00:00:00Z');
    expect(first.searchParams.get('to')).toBe('2026-10-27T00:00:00Z');
    expect(first.searchParams.has('channel')).toBe(false);
    expect(first.searchParams.has('page')).toBe(false);
    expect(first.searchParams.has('pageSize')).toBe(false);
    await waitFor(() => expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1));
    await u.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    await u.click(exportButton() as HTMLElement);
    await waitFor(() => expect(taken).toHaveLength(2));
    expect(new URL(taken[1].url, 'http://x').searchParams.get('channel')).toBe('PUSH');
  });

  it('sends one request when the button is pressed twice, and saves no file when the backend refuses', async () => {
    signIn('support', { codes: ['SMS:RECORD', 'SMS:RECORD:EXPORT'] });
    backend();
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const taken = overrideFetch(async ({ url }) => {
      if (url.pathname !== '/api/admin/sms/records/export') return undefined;
      await gate;
      return jsonAnswer(400, 'INVALID_REQUEST', null, 'raw words about rows');
    });
    renderPage(<RecordsPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    const button = exportButton() as HTMLElement;
    fireEvent.click(button);
    fireEvent.click(button);
    release();
    await waitFor(() => expect(taken).toHaveLength(1));
    await waitFor(() => expect(document.body.textContent).toContain('narrow the date range'));
    expect(document.body.textContent).not.toContain('raw words about rows');
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
  });

  it('shows the words of the code when the hourly limit is reached, and saves no file', async () => {
    signIn('support', { codes: ['SMS:RECORD', 'SMS:RECORD:EXPORT'] });
    backend();
    overrideFetch(({ url }) =>
      url.pathname === '/api/admin/sms/records/export'
        ? jsonAnswer(429, 'RATE_LIMITED', null, 'SECRET BACKEND WORDS')
        : undefined,
    );
    const u = user();
    renderPage(<RecordsPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    await u.click(exportButton() as HTMLElement);
    expect(
      await screen.findByText('Too many requests. Please try again later.'),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('SECRET BACKEND WORDS');
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
  });

  it('sends the Accept-Language of the interface, as every request does', async () => {
    signIn('support', { codes: ['SMS:RECORD', 'SMS:RECORD:EXPORT'] });
    backend();
    const seen: string[] = [];
    const inner = globalThis.fetch;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL, init: RequestInit = {}) => {
        if (String(input).includes('/records/export')) {
          seen.push(String((init.headers as Record<string, string>)['Accept-Language']));
          return sheetAnswer();
        }
        return inner(input, init);
      }),
    );
    const u = user();
    renderPage(<RecordsPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    await u.click(exportButton() as HTMLElement);
    await waitFor(() => expect(seen).toHaveLength(1));
    expect(seen[0]).toMatch(/^[a-z]{2}(-[A-Z]{2})?/);
  });
});
