import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { monitorStore } from '../../../mock/_core/monitorData';
import * as monitorMock from '../../../mock/monitor.mock';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import enUS from '../../locales/en-US';
import zhCN from '../../locales/zh-CN';
import { ALERT_TYPES, alertTypeKey } from '../../services/monitor';
import AlertsPage from './alerts';
import { signIn } from './testSetup';

const VIEW = ['MONITOR:VIEW'];
const MANAGE = ['MONITOR:VIEW', 'MONITOR:MANAGE'];

beforeEach(() => signIn('reviewer', MANAGE));
afterEach(() => vi.unstubAllGlobals());

type Row = (typeof monitorStore.alerts)[number];
const openOf = (type: string): Row =>
  monitorStore.alerts.find((a) => a.type === type && a.status === 'OPEN') as Row;
const rowOf = async (alert: Row) => {
  const cell = await screen.findByText(alert.detail ?? '', { selector: 'button' });
  const row = cell.closest('tr');
  if (!row) throw new Error('no row');
  return row as HTMLTableRowElement;
};
const posts = (calls: ReturnType<typeof useMockBackend>) =>
  calls.filter((c) => c.method === 'POST');
const alertRow = (over: Partial<Row>): Row => ({
  id: '900',
  type: 'DELETION_FAILED',
  accountId: '2001',
  refType: 'ACCOUNT_DELETION',
  refId: 'ref-1',
  detail: 'one detail',
  status: 'OPEN',
  createdAt: '2026-10-25T10:00:00.000Z',
  resolvedAt: null,
  ...over,
});
const fixed = (items: Row[]) =>
  stubFetch(async () => jsonResponse(200, envelope('200', { items, total: items.length })));

describe('the list', { timeout: 30000 }, () => {
  it('asks for the open alerts first, with the paging', async () => {
    const calls = useMockBackend(monitorMock);
    renderPage(<AlertsPage />);
    await rowOf(openOf('DELETION_FAILED'));
    const query = new URL(calls[0].url, 'http://x').searchParams;
    expect(query.get('status')).toBe('OPEN');
    expect(query.get('page')).toBe('1');
    expect(query.get('pageSize')).toBe('20');
  });

  it('shows the type as text, the account as a link to the user, the object, and the status', async () => {
    useMockBackend(monitorMock);
    renderPage(<AlertsPage />);
    const alert = openOf('DELETION_FAILED');
    const row = await rowOf(alert);
    expect(within(row).getByText('Account deletion failed')).toBeInTheDocument();
    const link = within(row).getByRole('link', { name: alert.accountId as string });
    expect(link).toHaveAttribute('href', `/users/${alert.accountId}`);
    expect(within(row).getByText(`${alert.refType}: ${alert.refId}`)).toBeInTheDocument();
    expect(within(row).getByText('Open')).toBeInTheDocument();
  });

  it('shows a dash where an alert has no account, and no link', async () => {
    useMockBackend(monitorMock);
    renderPage(<AlertsPage />);
    const row = await rowOf(openOf('SMS_DAILY_CAP_REACHED'));
    expect(within(row).queryByRole('link')).toBeNull();
    expect(within(row).getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });

  it('shows a type it does not know as it is, without breaking', async () => {
    fixed([alertRow({ type: 'BRAND_NEW_TYPE', detail: 'something new' })]);
    renderPage(<AlertsPage />);
    expect(await screen.findByText('BRAND_NEW_TYPE')).toBeInTheDocument();
    expect(screen.getByText('something new')).toBeInTheDocument();
  });

  it('shows a detail that is not text instead of breaking the table', async () => {
    fixed([alertRow({ id: '9', detail: { jobId: 'J-1' } as unknown as string })]);
    renderPage(<AlertsPage />);
    expect(await screen.findByText('{"jobId":"J-1"}')).toBeInTheDocument();
  });

  it.each([
    ['en-US', enUS],
    ['zh-CN', zhCN],
  ] as const)('shows every one of the eighteen types in words in %s', async (locale, texts) => {
    fixed(
      ALERT_TYPES.map((type, i) => alertRow({ id: String(i), type, detail: `detail ${type}` })),
    );
    renderPage(<AlertsPage />, locale);
    await screen.findByText(`detail ${ALERT_TYPES[0]}`);
    for (const type of ALERT_TYPES) {
      const row = (await screen.findByText(`detail ${type}`, { selector: 'button' })).closest(
        'tr',
      ) as HTMLElement;
      expect(within(row).getByText(texts[alertTypeKey(type)]), type).toBeInTheDocument();
    }
  });

  it('keeps a detail of 5000 characters without a space, and text of every language, inside the cell', async () => {
    const long = 'q'.repeat(5000);
    const texts = [
      long,
      'สวัสดีครับ',
      'مرحبا بك',
      'Terima kasih',
      'Cảm ơn bạn',
      'Muchas gracias',
      '谢谢',
      '😀'.repeat(60),
    ];
    fixed(texts.map((detail, i) => alertRow({ id: String(i), detail })));
    renderPage(<AlertsPage />);
    const cell = (await screen.findAllByText(long))[0];
    const button = cell.closest('button') as HTMLElement;
    expect(button.style.overflow).toBe('hidden');
    expect(button.style.maxWidth).not.toBe('');
    for (const text of texts.slice(1, 7))
      expect(screen.getAllByText(text).length).toBeGreaterThan(0);
  });

  it('filters by type and sends it', async () => {
    const calls = useMockBackend(monitorMock);
    const user = userEvent.setup();
    renderPage(<AlertsPage />);
    await rowOf(openOf('DELETION_FAILED'));
    await user.click(screen.getByRole('combobox', { name: 'Type' }));
    const options = await screen.findAllByText('Model has no price', {
      selector: '.ant-select-item-option-content',
    });
    await user.click(options[options.length - 1]);
    // the search button's own words come from ProTable, not from our language files
    const submit = document.querySelector('form button.ant-btn-primary') as HTMLElement;
    fireEvent.click(submit);
    await waitFor(() =>
      expect(calls.some((c) => c.url.includes('type=USAGE_PRICE_MISSING'))).toBe(true),
    );
  });

  it('shows the failure and a retry when the list cannot be read', async () => {
    stubFetch(async () => jsonResponse(500, envelope('INTERNAL_ERROR')));
    renderPage(<AlertsPage />);
    expect(await screen.findByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});

describe('the four types the backend added', { timeout: 30000 }, () => {
  const rowByRef = async (refId: string) => {
    const cell = await screen.findByText(new RegExp(`: ${refId}$`));
    return cell.closest('tr') as HTMLTableRowElement;
  };

  it('links the account of a support forwarding alert to the user and writes the fixed detail in words with the code beside it', async () => {
    fixed([
      alertRow({
        id: '31',
        type: 'SUPPORT_FORWARD_FAILED',
        accountId: '2003',
        refType: 'SUPPORT_FEEDBACK',
        refId: '8c1f0e52-7d3a-4f5b-9a10-0b6f1c2d3e4f',
        detail: 'attempts_exhausted',
      }),
    ]);
    renderPage(<AlertsPage />);
    const row = await rowByRef('8c1f0e52-7d3a-4f5b-9a10-0b6f1c2d3e4f');
    expect(within(row).getByText('Support feedback forwarding failed')).toBeInTheDocument();
    expect(within(row).getByRole('link', { name: '2003' })).toHaveAttribute('href', '/users/2003');
    expect(
      within(row).getByText('SUPPORT_FEEDBACK: 8c1f0e52-7d3a-4f5b-9a10-0b6f1c2d3e4f'),
    ).toBeInTheDocument();
    expect(
      within(row).getByText('All forwarding attempts were used up (attempts_exhausted)'),
    ).toBeInTheDocument();
  });

  it('writes the fixed detail in Chinese too, and does not add the backend message', async () => {
    fixed([
      alertRow({
        id: '32',
        type: 'SUPPORT_FORWARD_FAILED',
        refId: 'fb-1',
        detail: 'attempts_exhausted',
      }),
    ]);
    renderPage(<AlertsPage />, 'zh-CN');
    const row = await rowByRef('fb-1');
    expect(within(row).getByText('客服反馈转发失败')).toBeInTheDocument();
    expect(within(row).getByText('转发次数已用尽（attempts_exhausted）')).toBeInTheDocument();
  });

  it.each([
    ['token_unreadable', 'The stored access token cannot be read (token_unreadable)'],
    ['pixel_id_malformed', 'The stored pixel ID is malformed (pixel_id_malformed)'],
  ])('writes the postback detail %s in words, with no account to link', async (detail, text) => {
    fixed([
      alertRow({
        id: '33',
        type: 'POSTBACK_CREDENTIAL_FAILED',
        accountId: null,
        refType: 'ATTRIBUTION_CAMPAIGN',
        refId: 'camp-7',
        detail,
      }),
    ]);
    renderPage(<AlertsPage />);
    const row = await rowByRef('camp-7');
    expect(within(row).getByText('Campaign postback credential unusable')).toBeInTheDocument();
    expect(within(row).getByText(text)).toBeInTheDocument();
    expect(within(row).queryByRole('link')).toBeNull();
  });

  it('shows the error code of the ad platform, and an empty detail, as they are', async () => {
    fixed([
      alertRow({ id: '34', type: 'POSTBACK_CREDENTIAL_FAILED', refId: 'camp-8', detail: '190' }),
      alertRow({ id: '35', type: 'POSTBACK_CREDENTIAL_FAILED', refId: 'camp-9', detail: null }),
      alertRow({
        id: '36',
        type: 'POSTBACK_CREDENTIAL_FAILED',
        refId: 'camp-10',
        detail: 'attempts_exhausted',
      }),
    ]);
    renderPage(<AlertsPage />);
    expect(within(await rowByRef('camp-8')).getByText('190')).toBeInTheDocument();
    expect(within(await rowByRef('camp-9')).getAllByText('—').length).toBeGreaterThan(0);
    // a fixed value of another type is not translated here: it is shown as it comes
    expect(within(await rowByRef('camp-10')).getByText('attempts_exhausted')).toBeInTheDocument();
  });

  it('shows what a subscription event alert carries as it comes, whatever it is, and invents no explanation', async () => {
    fixed([
      alertRow({
        id: '37',
        type: 'SUBSCRIPTION_EVENT_FAILED',
        refType: 'ผู้ใช้ 😀',
        refId: 'evt-1',
        detail: { code: 'ก'.repeat(10) } as unknown as string,
      }),
    ]);
    renderPage(<AlertsPage />);
    const row = await rowByRef('evt-1');
    expect(within(row).getByText('Subscription event processing failed')).toBeInTheDocument();
    expect(within(row).getByText('ผู้ใช้ 😀: evt-1')).toBeInTheDocument();
    expect(within(row).getByText(`{"code":"${'ก'.repeat(10)}"}`)).toBeInTheDocument();
  });

  it('writes a related object whose type or id is not a string as text, never as [object Object]', async () => {
    fixed([
      alertRow({
        id: '61',
        refType: { kind: 'ก' } as unknown as string,
        refId: { ids: [1, 2] } as unknown as string,
        detail: 'object-valued ref',
      }),
      alertRow({
        id: '62',
        refType: 12345 as unknown as string,
        refId: 0 as unknown as string,
        detail: 'number-valued ref',
      }),
      alertRow({
        id: '63',
        refType: ['a', 'b'] as unknown as string,
        refId: true as unknown as string,
        detail: 'list-valued ref',
      }),
    ]);
    renderPage(<AlertsPage />);
    const objectRow = (await screen.findByText('object-valued ref')).closest('tr') as HTMLElement;
    expect(within(objectRow).getByText('{"kind":"ก"}: {"ids":[1,2]}')).toBeInTheDocument();
    const numberRow = (await screen.findByText('number-valued ref')).closest('tr') as HTMLElement;
    expect(within(numberRow).getByText('12345: 0')).toBeInTheDocument();
    const listRow = (await screen.findByText('list-valued ref')).closest('tr') as HTMLElement;
    expect(within(listRow).getByText('["a","b"]: true')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('[object');
  });

  it('shows the re-landing alert with the lander and the day as they come, and the class name of the exception', async () => {
    fixed([
      alertRow({
        id: '38',
        type: 'STAT_RELAND_FAILED',
        accountId: null,
        refType: 'STAT_RELAND_DAY',
        refId: 'usage-cost:2026-10-10',
        detail: 'java.lang.IllegalStateException',
      }),
    ]);
    renderPage(<AlertsPage />);
    const row = await rowByRef('usage-cost:2026-10-10');
    expect(within(row).getByText('Statistics re-landing failed')).toBeInTheDocument();
    expect(within(row).getByText('STAT_RELAND_DAY: usage-cost:2026-10-10')).toBeInTheDocument();
    expect(within(row).getByText('java.lang.IllegalStateException')).toBeInTheDocument();
  });

  it.each([
    ['Support feedback forwarding failed', 'SUPPORT_FORWARD_FAILED'],
    ['Campaign postback credential unusable', 'POSTBACK_CREDENTIAL_FAILED'],
    ['Subscription event processing failed', 'SUBSCRIPTION_EVENT_FAILED'],
    ['Statistics re-landing failed', 'STAT_RELAND_FAILED'],
  ])('offers %s in the type filter and sends %s', async (label, code) => {
    const calls = useMockBackend(monitorMock);
    const user = userEvent.setup();
    renderPage(<AlertsPage />);
    await rowOf(openOf('DELETION_FAILED'));
    const box = screen.getByRole('combobox', { name: 'Type' });
    await user.click(box);
    await user.type(box, label.split(' ')[0]);
    const options = await screen.findAllByText(label, {
      selector: '.ant-select-item-option-content',
    });
    await user.click(options[options.length - 1]);
    fireEvent.click(document.querySelector('form button.ant-btn-primary') as HTMLElement);
    await waitFor(() => expect(calls.some((c) => c.url.includes(`type=${code}`))).toBe(true));
  });
});

describe('closing an alert', { timeout: 30000 }, () => {
  it('shows "Close" to MONITOR:MANAGE on the open rows only', async () => {
    signIn('reviewer', MANAGE);
    useMockBackend(monitorMock);
    renderPage(<AlertsPage />);
    await rowOf(openOf('DELETION_FAILED'));
    const open = monitorStore.alerts.filter((a) => a.status === 'OPEN').length;
    expect(screen.getAllByRole('button', { name: 'Close' })).toHaveLength(Math.min(open, 20));
  });

  it('does not show "Close" without MONITOR:MANAGE', async () => {
    signIn('reviewer', VIEW);
    useMockBackend(monitorMock);
    renderPage(<AlertsPage />);
    await rowOf(openOf('DELETION_FAILED'));
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
  });

  it('does not show "Close" on a resolved alert', async () => {
    fixed([
      alertRow({ status: 'RESOLVED', resolvedAt: '2026-10-25T11:00:00.000Z', detail: 'done one' }),
    ]);
    renderPage(<AlertsPage />);
    const cell = await screen.findByText('done one');
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
    expect(within(cell.closest('tr') as HTMLElement).getByText('Resolved')).toBeInTheDocument();
  });

  it('asks first, then posts to /alerts/{id}/resolve, says it is closed and takes the row from the open list', async () => {
    const calls = useMockBackend(monitorMock);
    const user = userEvent.setup();
    renderPage(<AlertsPage />);
    const alert = openOf('CREDIT_UNCONSUMED');
    await user.click(within(await rowOf(alert)).getByRole('button', { name: 'Close' }));
    expect(await screen.findByText('Close this alert?')).toBeInTheDocument();
    expect(posts(calls)).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'OK' }));
    await screen.findByText('Alert closed');
    expect(posts(calls).map((c) => c.url)).toEqual([`/api/admin/alerts/${alert.id}/resolve`]);
    expect(alert.status).toBe('RESOLVED');
    await waitFor(() => expect(screen.queryByText(alert.detail ?? '')).toBeNull());
  });

  it('does not close when the question is cancelled', async () => {
    const calls = useMockBackend(monitorMock);
    const user = userEvent.setup();
    renderPage(<AlertsPage />);
    const alert = openOf('CREDIT_UNCONSUMED');
    await user.click(within(await rowOf(alert)).getByRole('button', { name: 'Close' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    await new Promise((r) => setTimeout(r, 100));
    expect(posts(calls)).toHaveLength(0);
    expect(alert.status).toBe('OPEN');
  });

  it('says in the question what closing a LOOK_PACKAGE_PREPARE_FAILED alert does (zh-CN)', async () => {
    useMockBackend(monitorMock);
    const user = userEvent.setup();
    renderPage(<AlertsPage />, 'zh-CN');
    const alert = openOf('LOOK_PACKAGE_PREPARE_FAILED');
    await user.click(within(await rowOf(alert)).getByRole('button', { name: '关闭' }));
    const question = await screen.findByText(/会把这个驱动资源包的失败次数清零并重新排准备任务/);
    expect(question).toBeInTheDocument();
  });

  it('says it in English too, and only for that type', async () => {
    useMockBackend(monitorMock);
    const user = userEvent.setup();
    renderPage(<AlertsPage />);
    await user.click(
      within(await rowOf(openOf('LOOK_PACKAGE_PREPARE_FAILED'))).getByRole('button', {
        name: 'Close',
      }),
    );
    expect(
      await screen.findByText(
        /resets the failure count of this driving package to zero and queues the prepare job again/,
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(
      within(await rowOf(openOf('DELETION_FAILED'))).getByRole('button', { name: 'Close' }),
    );
    expect(await screen.findByText('Close this alert?')).toBeInTheDocument();
  });

  it('resets the driving package in the backend when that alert is closed', async () => {
    useMockBackend(monitorMock);
    const user = userEvent.setup();
    renderPage(<AlertsPage />);
    const alert = openOf('LOOK_PACKAGE_PREPARE_FAILED');
    await user.click(within(await rowOf(alert)).getByRole('button', { name: 'Close' }));
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    await screen.findByText('Alert closed');
    expect(monitorStore.lookPackageResets).toEqual([alert.refId]);
  });

  it('shows the text of the refusal when the alert was already resolved by the backend, and reads the list again', async () => {
    const calls = useMockBackend(monitorMock);
    const user = userEvent.setup();
    renderPage(<AlertsPage />);
    const alert = openOf('CREDIT_UNCONSUMED');
    await user.click(within(await rowOf(alert)).getByRole('button', { name: 'Close' }));
    alert.status = 'RESOLVED'; // the backend resolved it by itself in the meantime
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    expect(
      await screen.findByText('The current state of the item does not allow this action.'),
    ).toBeInTheDocument();
    await waitFor(() => expect(calls.filter((c) => c.method === 'GET').length).toBeGreaterThan(1));
  });

  it('sends once when OK is pressed twice', async () => {
    const calls = useMockBackend(monitorMock);
    const user = userEvent.setup();
    renderPage(<AlertsPage />);
    await user.click(
      within(await rowOf(openOf('CREDIT_UNCONSUMED'))).getByRole('button', { name: 'Close' }),
    );
    const ok = await screen.findByRole('button', { name: 'OK' });
    fireEvent.click(ok);
    fireEvent.click(ok);
    await new Promise((r) => setTimeout(r, 200));
    expect(posts(calls)).toHaveLength(1);
  });

  it('does not send the write again when the token ended during it', async () => {
    const row = alertRow({ detail: 'token one' });
    const calls = stubFetch(async ({ init }) =>
      (init.method ?? 'GET') === 'GET'
        ? jsonResponse(200, envelope('200', { items: [row], total: 1 }))
        : jsonResponse(401, envelope('ADMIN_INVALID_TOKEN')),
    );
    const user = userEvent.setup();
    renderPage(<AlertsPage />);
    await user.click(within(await rowOf(row)).getByRole('button', { name: 'Close' }));
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    await waitFor(() => expect(calls.filter((c) => c.init.method === 'POST')).toHaveLength(1));
    await new Promise((r) => setTimeout(r, 100));
    expect(calls.filter((c) => c.init.method === 'POST')).toHaveLength(1);
  });
});
