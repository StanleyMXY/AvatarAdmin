import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { REGISTRY } from '../../../mock/_core/clientConfigData';
import clientConfigMock from '../../../mock/clientConfig.mock';
import configMock from '../../../mock/config.mock';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import enUS from '../../locales/en-US';
import zhCN from '../../locales/zh-CN';
import type { ClientConfigItem } from '../../services/clientConfig';
import ClientConfigPage from './list';
import { signIn, writesOf } from './testSetup';

vi.setConfig({ testTimeout: 30000 });

beforeEach(() => signIn('root'));
afterEach(() => vi.unstubAllGlobals());

const item = (over: Partial<ClientConfigItem> = {}): ClientConfigItem => ({
  key: 'privacyPolicyUrl',
  type: 'URL',
  localized: true,
  readOnly: false,
  configured: true,
  defaultValue: null,
  values: { '': 'https://example.com/p' },
  updatedBy: '1001',
  updatedByUsername: 'root',
  updatedAt: '2026-10-20T08:30:00.000Z',
  ...over,
});
const fixed = (items: unknown[]) =>
  stubFetch(async () => jsonResponse(200, envelope('200', { items })));

const tableRows = () => [
  ...document.querySelectorAll<HTMLElement>('.ant-table-tbody tr.ant-table-row'),
];
const headers = () =>
  [...document.querySelectorAll('.ant-table-thead th')].map((th) => th.textContent);
const cellsOf = (tr: Element) => [...tr.querySelectorAll('td')].map((td) => td.textContent ?? '');
const rowOf = (key: string) =>
  tableRows().find((tr) => tr.querySelector('td')?.textContent?.startsWith(key)) as HTMLElement;
const backend = () => useMockBackend({ default: clientConfigMock }, { default: configMock });

describe('the list of keys', () => {
  it('has the columns of the spec: key, description, type, per language, configured, where the client uses it', async () => {
    backend();
    renderPage(<ClientConfigPage />);
    await waitFor(() => expect(tableRows().length).toBe(19));
    expect(headers()).toEqual([
      'Key',
      'Description',
      'Type',
      'Per language',
      'Configured',
      'Where the client uses it',
      'Actions',
    ]);
  });

  it('shows every registered key once, in the order of the backend, and nothing named inviteShareSubtitle', async () => {
    backend();
    renderPage(<ClientConfigPage />);
    await waitFor(() => expect(tableRows().length).toBe(19));
    const keys = tableRows().map((tr) => cellsOf(tr)[0].replace(/Read only$/, ''));
    expect(keys).toEqual([...keys].sort());
    expect(keys).not.toContain('inviteShareSubtitle');
    expect(document.body.textContent).not.toContain('inviteShareSubtitle');
  });

  it('writes the description and the use of each key from the language file, and the type, the per-language answer and whether it is configured', async () => {
    backend();
    renderPage(<ClientConfigPage />);
    await waitFor(() => expect(tableRows().length).toBe(19));
    const privacy = cellsOf(rowOf('privacyPolicyUrl'));
    expect(privacy[1]).toBe(enUS['clientConfig.privacyPolicyUrl.desc']);
    expect(privacy[2]).toBe('Link (URL)');
    expect(privacy[3]).toBe('Yes');
    expect(privacy[4]).toContain('Configured');
    expect(privacy[5]).toBe(enUS['clientConfig.privacyPolicyUrl.usage']);
    const support = cellsOf(rowOf('supportUrl'));
    expect(support[4]).toBe('Not configured');
    const email = cellsOf(rowOf('supportEmail'));
    expect(email[2]).toBe('E-mail (EMAIL)');
    expect(email[3]).toBe('No');
  });

  it('has a description and a use in both languages for every key of the registry, a source for the read-only ones, and nothing for inviteShareSubtitle', () => {
    for (const messages of [enUS, zhCN]) {
      for (const def of REGISTRY) {
        expect(messages[`clientConfig.${def.key}.desc`], def.key).toBeTruthy();
        expect(messages[`clientConfig.${def.key}.usage`], def.key).toBeTruthy();
        if (def.source)
          expect(messages[`clientConfig.${def.key}.source`], def.key).toBe(def.source);
      }
      expect(Object.keys(messages).filter((k) => k.includes('inviteShareSubtitle'))).toEqual([]);
    }
  });

  it('shows the key itself where the language file has no text for it', async () => {
    fixed([item({ key: 'someNewKey', type: 'STRING' })]);
    renderPage(<ClientConfigPage />);
    await waitFor(() => expect(tableRows().length).toBe(1));
    const cells = cellsOf(tableRows()[0]);
    expect(cells[0]).toBe('someNewKey');
    expect(cells[1]).toBe('someNewKey');
    expect(cells[5]).toBe('someNewKey');
  });

  it('shows a type it does not know as it is', async () => {
    fixed([item({ type: 'TIMESTAMP' })]);
    renderPage(<ClientConfigPage />);
    await waitFor(() => expect(tableRows().length).toBe(1));
    expect(cellsOf(tableRows()[0])[2]).toBe('TIMESTAMP');
  });

  it('marks exactly the keys the interface says are read only, each with where it comes from and a way to the system configuration', async () => {
    backend();
    renderPage(<ClientConfigPage />);
    await waitFor(() => expect(tableRows().length).toBe(19));
    const readOnly = tableRows().filter((tr) => cellsOf(tr)[0].endsWith('Read only'));
    expect(readOnly.map((tr) => cellsOf(tr)[0].replace('Read only', ''))).toEqual([
      'accountDeletionGraceDays',
      'conversationLanguages',
      'phoneLoginEnabled',
      'voiceMaxSeconds',
      'voiceMinSeconds',
      'voiceTranscriptMaxChars',
    ]);
    expect(cellsOf(rowOf('phoneLoginEnabled'))[4]).toContain(
      'Decided by the auth.phone_login_enabled setting; change it in System configuration',
    );
    expect(cellsOf(rowOf('accountDeletionGraceDays'))[4]).toContain('deletion.grace_days');
    expect(
      within(rowOf('voiceMinSeconds'))
        .getByRole('link', { name: 'Open System configuration' })
        .getAttribute('href'),
    ).toBe('/config');
  });

  it('does not write which keys are read only: a key the interface marks read only is, one it does not is not', async () => {
    fixed([
      item({ key: 'privacyPolicyUrl', readOnly: true }),
      item({
        key: 'phoneLoginEnabled',
        type: 'BOOLEAN',
        localized: false,
        readOnly: false,
        values: { '': true },
      }),
      item({ key: 'brandNewKey', type: 'INT', readOnly: true, values: { '': 3 } }),
    ]);
    renderPage(<ClientConfigPage />);
    await waitFor(() => expect(tableRows().length).toBe(3));
    expect(cellsOf(rowOf('privacyPolicyUrl'))[0]).toContain('Read only');
    expect(cellsOf(rowOf('phoneLoginEnabled'))[0]).not.toContain('Read only');
    expect(cellsOf(rowOf('brandNewKey'))[4]).toContain(
      'Decided by the system configuration; change it in System configuration',
    );
  });

  it('gives no link to the system configuration to an administrator who cannot open it', async () => {
    signIn('reviewer', { codes: ['CLIENTCONFIG:VIEW'] });
    backend();
    renderPage(<ClientConfigPage />);
    await waitFor(() => expect(tableRows().length).toBe(19));
    expect(screen.queryByRole('link', { name: 'Open System configuration' })).toBeNull();
    expect(cellsOf(rowOf('phoneLoginEnabled'))[4]).toContain('auth.phone_login_enabled');
  });

  it('says at the top that an entry that is not configured is not shown in the app', async () => {
    backend();
    renderPage(<ClientConfigPage />);
    expect(
      await screen.findByText('A link entry that is not configured is not shown in the app.'),
    ).toBeInTheDocument();
  });

  it('shows the failure with a retry that reads again', async () => {
    let fail = true;
    stubFetch(async () =>
      fail
        ? jsonResponse(500, envelope('INTERNAL_ERROR'))
        : jsonResponse(200, envelope('200', { items: [item()] })),
    );
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    const retry = await screen.findByRole('button', { name: 'Retry' });
    fail = false;
    await user.click(retry);
    await waitFor(() => expect(tableRows().length).toBe(1));
  });

  it('shows the empty text when the backend lists no key', async () => {
    fixed([]);
    renderPage(<ClientConfigPage />);
    expect(await screen.findByText('No registered keys')).toBeInTheDocument();
  });

  it('does not break on rows that are not what the contract says', async () => {
    fixed([
      item({
        key: 7 as never,
        type: null as never,
        localized: 'yes' as never,
        values: 'x' as never,
      }),
      null,
      'string row',
      item({ key: 'ok', values: null as never, configured: 'maybe' as never }),
    ]);
    renderPage(<ClientConfigPage />);
    await waitFor(() => expect(tableRows().length).toBeGreaterThanOrEqual(2));
  });

  it('keeps 5000 characters without a space, Thai, Arabic and emoji inside the cells', async () => {
    fixed([
      item({ key: 'x'.repeat(5000), type: 'STRING' }),
      item({ key: 'مرحبا😀', type: 'STRING' }),
    ]);
    renderPage(<ClientConfigPage />);
    await waitFor(() => expect(tableRows().length).toBe(2));
    const long = within(tableRows()[0]).getAllByText('x'.repeat(5000))[0];
    expect(long.closest('[style*="overflow-wrap: anywhere"]')).not.toBeNull();
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth + 1);
  });
});

describe('in Chinese', () => {
  it('shows the headers and the words of the keys in Chinese, and no language key', async () => {
    backend();
    renderPage(<ClientConfigPage />, 'zh-CN');
    await waitFor(() => expect(tableRows().length).toBe(19));
    expect(headers()).toEqual([
      '键',
      '说明',
      '类型',
      '按语言区分',
      '是否已配置',
      '客户端使用点',
      '操作',
    ]);
    expect(cellsOf(rowOf('privacyPolicyUrl'))[1]).toBe(zhCN['clientConfig.privacyPolicyUrl.desc']);
    expect(cellsOf(rowOf('phoneLoginEnabled'))[4]).toContain(
      '由 auth.phone_login_enabled 配置决定，在系统配置里改',
    );
    expect(await screen.findByText('未配置的链接类入口在 App 里不显示。')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/clientConfig\.[a-zA-Z]+\./);
  });
});

describe('who can change a key', () => {
  it('offers Edit to an administrator with CLIENTCONFIG:MANAGE and View to one without', async () => {
    backend();
    const { unmount } = renderPage(<ClientConfigPage />);
    await waitFor(() => expect(tableRows().length).toBe(19));
    expect(within(rowOf('supportUrl')).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    unmount();
    signIn('reviewer', { codes: ['CLIENTCONFIG:VIEW'] });
    backend();
    renderPage(<ClientConfigPage />);
    await waitFor(() => expect(tableRows().length).toBe(19));
    expect(within(rowOf('supportUrl')).getByRole('button', { name: 'View' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
  });

  it('opens an editor when a row is pressed and mounts none before', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    await waitFor(() => expect(tableRows().length).toBe(19));
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(within(rowOf('supportUrl')).getByText(enUS['clientConfig.supportUrl.desc']));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(await screen.findByText('Client configuration: supportUrl')).toBeInTheDocument();
  });
});

describe('the list after a save', () => {
  it('reads again after a save and shows the new state, and an older read that comes back later does not overwrite the newer one', async () => {
    const calls = backend();
    const mocked = globalThis.fetch;
    const held: (() => void)[] = [];
    let readCount = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL, init: RequestInit = {}) => {
        const method = (init.method ?? 'GET').toUpperCase();
        if (method === 'GET' && String(input).endsWith('/client-config')) {
          readCount += 1;
          // Reads: 1 the page, 2 the check before the first save, 3 the list after that save.
          if (readCount === 3) {
            // The read after the first save: answered with the state at that moment, but late.
            const answer = await mocked(input, init);
            const body = await answer.text();
            await new Promise<void>((resolve) => held.push(resolve));
            return new Response(body, {
              status: 200,
              headers: { 'content-type': 'application/json' },
            });
          }
        }
        return mocked(input, init);
      }),
    );
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    await waitFor(() => expect(tableRows().length).toBe(19));
    expect(cellsOf(rowOf('supportUrl'))[4]).toBe('Not configured');
    expect(cellsOf(rowOf('drivingLookaheadMs'))[4]).toBe('Not configured');

    await user.click(within(rowOf('supportUrl')).getByRole('button', { name: 'Edit' }));
    let drawer = await screen.findByRole('dialog');
    await user.click(await within(drawer).findByRole('button', { name: 'Add the default value' }));
    fireEvent.change(await within(drawer).findByRole('textbox', { name: 'Value (Default)' }), {
      target: { value: 'https://help.example.com/' },
    });
    await user.click(within(drawer).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(held.length).toBe(1));

    // The read after the first save is still on its way; a second key is saved meanwhile.
    await waitFor(() => expect(screen.queryByText('Client configuration: supportUrl')).toBeNull());
    await user.click(within(rowOf('drivingLookaheadMs')).getByRole('button', { name: 'Edit' }));
    drawer = await screen.findByRole('dialog');
    await user.click(await within(drawer).findByRole('button', { name: 'Add the default value' }));
    fireEvent.change(await within(drawer).findByRole('spinbutton', { name: 'Value (Default)' }), {
      target: { value: '321' },
    });
    await user.click(within(drawer).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(cellsOf(rowOf('drivingLookaheadMs'))[4]).toBe('Configured'));

    held[0]();
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(cellsOf(rowOf('drivingLookaheadMs'))[4]).toBe('Configured');
    expect(cellsOf(rowOf('supportUrl'))[4]).toBe('Configured');
    expect(writesOf(calls).length).toBe(2);
  });
});
