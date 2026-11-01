import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnalyticsEventRow } from '../../../mock/_core/analyticsData';
import * as analyticsMock from '../../../mock/analytics.mock';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import { withTimeZone } from '../../../tests/withTimeZone';
import DetailPage from './detail';
import { signIn, VIEW } from './testSetup';

beforeEach(() => signIn('support', { codes: VIEW }));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const eventCalls = (calls: { url: string }[]) =>
  calls.filter((c) => new URL(c.url, 'http://x').pathname.endsWith('/analytics/events'));
const lastEvents = (calls: { url: string }[]) =>
  new URL(eventCalls(calls).at(-1)?.url as string, 'http://x');
const dataRows = () =>
  Array.from(document.querySelectorAll('tbody tr.ant-table-row')) as HTMLElement[];

const event = (over: Partial<AnalyticsEventRow>): AnalyticsEventRow => ({
  id: '1',
  eventName: 'app_open',
  accountId: '2001',
  deviceId: '7d0c0000-0000-4000-8000-000000000001',
  source: 'CLIENT',
  params: { sessionId: 's-1' },
  context: { platform: 'ANDROID', appVersion: '1.2.3', osVersion: '14', locale: 'th-TH' },
  clientTime: '2026-10-26T01:02:03.456Z',
  receivedAt: '2026-10-26T01:02:05.000Z',
  seq: 0,
  ip: '203.0.113.*',
  country: 'TH',
  ...over,
});
const answer = (items: AnalyticsEventRow[], total = items.length) =>
  stubFetch((c) =>
    jsonResponse(
      200,
      envelope(
        '200',
        c.url.includes('event-names')
          ? { items: ['app_open', 'session_started', 'register_completed'] }
          : { items: items.map(({ source: _s, seq: _q, ...rest }) => rest), total },
      ),
    ),
  );

describe('the event detail page', { timeout: 30000 }, () => {
  it('starts with the longest range the backend allows when that is shorter than 7 days', async () => {
    signIn('support', { codes: VIEW, meta: { analyticsLiveMaxRangeDays: 2 } });
    const calls = useMockBackend(analyticsMock);
    renderPage(<DetailPage />);
    await waitFor(() => expect(eventCalls(calls)).toHaveLength(1));
    const url = lastEvents(calls);
    expect(
      Date.parse(`${url.searchParams.get('to')}T00:00:00Z`) -
        Date.parse(`${url.searchParams.get('from')}T00:00:00Z`),
    ).toBe(86400000);
  });

  it('writes in the header itself that the client time is self-reported, not only in a hint that a keyboard or a finger cannot open', async () => {
    answer([event({})]);
    renderPage(<DetailPage />);
    await screen.findByText('app_open', { selector: 'td *, td' });
    expect(
      screen.getByRole('columnheader', { name: /Client time \(self-reported\)/ }),
    ).toBeTruthy();
  });

  it('says on the IP header that the address is shown as the backend sends it', async () => {
    answer([event({})]);
    renderPage(<DetailPage />);
    await screen.findByText('app_open', { selector: 'td *, td' });
    const header = screen.getByRole('columnheader', { name: /^IP/ });
    await userEvent.hover(header.querySelector('.anticon') as HTMLElement);
    expect(
      await screen.findByText(
        'Shown as the backend sends it: masked unless you hold the permission to see whole IP addresses',
      ),
    ).toBeInTheDocument();
  });

  it('asks for the last 7 UTC days by default, 20 rows a page, and says the days are UTC', async () => {
    const calls = useMockBackend(analyticsMock);
    renderPage(<DetailPage />);
    await waitFor(() => expect(eventCalls(calls)).toHaveLength(1));
    const url = lastEvents(calls);
    expect(url.searchParams.get('page')).toBe('1');
    expect(url.searchParams.get('pageSize')).toBe('20');
    const today = new Date().toISOString().slice(0, 10);
    expect(url.searchParams.get('to')).toBe(today);
    expect(
      Date.parse(`${today}T00:00:00Z`) - Date.parse(`${url.searchParams.get('from')}T00:00:00Z`),
    ).toBe(6 * 86400000);
    expect(screen.getByText(/UTC days/)).toBeInTheDocument();
  });

  it('uses the UTC date in Singapore between 00:00 and 08:00', async () => {
    await withTimeZone('Asia/Singapore', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-10-26T17:30:00Z'));
      const calls = useMockBackend(analyticsMock);
      renderPage(<DetailPage />);
      await waitFor(() => expect(eventCalls(calls)).toHaveLength(1));
      expect(lastEvents(calls).searchParams.get('to')).toBe('2026-10-26');
    });
  });

  it('has no way to clear the time range: it is required', async () => {
    useMockBackend(analyticsMock);
    renderPage(<DetailPage />);
    await waitFor(() => expect(dataRows().length).toBeGreaterThan(0));
    expect(document.querySelector('.ant-picker-clear')).toBeNull();
    for (const input of document.querySelectorAll('.ant-picker-input input')) {
      expect((input as HTMLInputElement).value).not.toBe('');
    }
  });

  it('shows the columns of the spec and the IP exactly as the backend sent it', async () => {
    answer([
      event({ ip: '203.0.113.*' }),
      event({ id: '2', accountId: null, ip: '2001:db8:85a3:0:0:8a2e:370:7334', country: null }),
    ]);
    renderPage(<DetailPage />);
    await screen.findByText('203.0.113.*');
    for (const title of [
      'Event name',
      'Account',
      'Device',
      'Received at',
      'Client time',
      'Platform',
      'App version',
      'Country',
      'IP',
    ]) {
      expect(
        screen.getByRole('columnheader', { name: new RegExp(title) }),
        title,
      ).toBeInTheDocument();
    }
    const [first, second] = dataRows();
    expect(first.textContent).toContain('2001');
    expect(first.textContent).toContain('ANDROID');
    expect(first.textContent).toContain('1.2.3');
    expect(first.textContent).toContain('TH');
    expect(second.textContent).toContain('2001:db8:85a3:0:0:8a2e:370:7334');
    // an anonymous event and a missing country are a dash, not 0 or null
    expect(within(second).getAllByText('—').length).toBeGreaterThanOrEqual(2);
    expect(document.body.textContent).not.toMatch(/\bnull\b|undefined|NaN/);
  });

  it('says on the client time that the app reported it and it cannot be trusted, and which time the statistics use', async () => {
    answer([event({})]);
    renderPage(<DetailPage />);
    await screen.findByText('app_open', { selector: 'td *, td' });
    const hover = async (title: RegExp) => {
      const header = screen.getByRole('columnheader', { name: title });
      await userEvent.hover(header.querySelector('.anticon') as HTMLElement);
    };
    await hover(/Client time/);
    expect(
      await screen.findByText(
        'Reported by the client itself, not trustworthy; for troubleshooting only',
      ),
    ).toBeInTheDocument();
    await hover(/Received at/);
    expect(
      await screen.findByText('Time the server received the event; the statistics use this time'),
    ).toBeInTheDocument();
  });

  it('unfolds a row to the formatted params and context, with Thai, Arabic and emoji intact', async () => {
    const params = { text: 'สวัสดี مرحبا 🎉', nested: { n: 1 } };
    answer([event({ params, context: { platform: 'IOS', appVersion: '2.0.0', locale: 'ar-SA' } })]);
    renderPage(<DetailPage />);
    await screen.findByText('app_open', { selector: 'td *, td' });
    await userEvent.click(document.querySelector('.ant-table-row-expand-icon') as HTMLElement);
    const paramsBox = await screen.findByTestId('analytics-params');
    expect(paramsBox.textContent).toBe(JSON.stringify(params, null, 2));
    expect(screen.getByTestId('analytics-context').textContent).toBe(
      JSON.stringify({ platform: 'IOS', appVersion: '2.0.0', locale: 'ar-SA' }, null, 2),
    );
  });

  it('shows a dash for params or context that are missing, and a 5000 character string does not widen the page', async () => {
    const huge = 'ก็'.repeat(2500);
    answer([event({ id: '1', params: null }), event({ id: '2', params: { huge } })]);
    renderPage(<DetailPage />);
    await screen.findAllByText('app_open', { selector: 'td *, td' });
    for (const icon of document.querySelectorAll('.ant-table-row-expand-icon'))
      await userEvent.click(icon as HTMLElement);
    const boxes = await screen.findAllByTestId('analytics-params');
    expect(boxes[0].textContent).toBe('—');
    expect(boxes[1].textContent).toContain(huge);
    expect(boxes[1].style.overflowWrap || getComputedStyle(boxes[1]).overflowWrap).toBe('anywhere');
  });

  it('suggests event names from event-names for the range, and sends the chosen filters, whitespace trimmed', async () => {
    const calls = useMockBackend(analyticsMock);
    renderPage(<DetailPage />);
    await waitFor(() => expect(eventCalls(calls)).toHaveLength(1));
    await waitFor(() =>
      expect(calls.some((c) => c.url.includes('/analytics/event-names'))).toBe(true),
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Account ID'), '  2001 ');
    await user.type(screen.getByLabelText('Device ID'), 'dev-1');
    const name = screen.getByLabelText('Event name');
    await user.type(name, 'sess');
    const option = await screen.findByText('session_started', {
      selector: '.ant-select-item-option-content',
    });
    await user.click(option);
    await user.click(screen.getByRole('button', { name: 'Query' }));
    await waitFor(() => expect(eventCalls(calls)).toHaveLength(2));
    const url = lastEvents(calls);
    expect(url.searchParams.get('accountId')).toBe('2001');
    expect(url.searchParams.get('deviceId')).toBe('dev-1');
    expect(url.searchParams.get('eventName')).toBe('session_started');
    expect(url.searchParams.get('page')).toBe('1');
  });

  it('does not ask while a filter is only being typed, only when Query is pressed', async () => {
    const calls = useMockBackend(analyticsMock);
    renderPage(<DetailPage />);
    await waitFor(() => expect(eventCalls(calls)).toHaveLength(1));
    await userEvent.type(screen.getByLabelText('Account ID'), '2');
    await new Promise((r) => setTimeout(r, 100));
    expect(eventCalls(calls)).toHaveLength(1);
  });

  it('goes to the next page with the same filters and the page number', async () => {
    const calls = useMockBackend(analyticsMock);
    renderPage(<DetailPage />);
    await waitFor(() => expect(dataRows().length).toBe(20));
    await userEvent.click(screen.getByTitle('2'));
    await waitFor(() => expect(eventCalls(calls)).toHaveLength(2));
    expect(lastEvents(calls).searchParams.get('page')).toBe('2');
  });

  it('shows only the words of the code when the backend refuses, with a retry', async () => {
    stubFetch((c) =>
      c.url.includes('event-names')
        ? jsonResponse(200, envelope('200', { items: [] }))
        : jsonResponse(
            400,
            envelope('INVALID_REQUEST', { details: [] }, 'range is longer than 31 days'),
          ),
    );
    renderPage(<DetailPage />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).not.toContain('range is longer than 31 days');
    expect(within(alert).getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('still shows the events when the event-name suggestions cannot be read', async () => {
    stubFetch((c) =>
      c.url.includes('event-names')
        ? jsonResponse(500, envelope('INTERNAL_ERROR'))
        : jsonResponse(
            200,
            envelope('200', { items: [{ ...event({}), source: undefined }], total: 1 }),
          ),
    );
    renderPage(<DetailPage />);
    expect(await screen.findByText('203.0.113.*')).toBeInTheDocument();
  });

  it('shows an empty table when nothing matches', async () => {
    answer([]);
    renderPage(<DetailPage />);
    expect(await screen.findByText('No events match')).toBeInTheDocument();
  });

  it('shows the times in the browser time zone with the locale, and the device id without breaking the table', async () => {
    await withTimeZone('Asia/Singapore', async () => {
      answer([event({ receivedAt: '2026-10-26T17:30:00.000Z', deviceId: 'ก'.repeat(300) })]);
      renderPage(<DetailPage />);
      await screen.findByText('app_open', { selector: 'td *, td' });
      expect(
        screen.getByText(/10\/27\/2026, 01:30:00|27\/10\/2026, 01:30:00|2026-10-27 01:30:00/),
      ).toBeInTheDocument();
    });
  });

  it('sorts nothing itself: the rows stay in the order of the backend', async () => {
    answer([
      event({ id: '1', eventName: 'zzz', accountId: '1' }),
      event({ id: '2', eventName: 'aaa', accountId: '2' }),
    ]);
    renderPage(<DetailPage />);
    await screen.findByText('zzz', { selector: 'td *, td' });
    expect(dataRows().map((r) => r.querySelectorAll('td')[1]?.textContent)).toEqual(['zzz', 'aaa']);
  });
});
