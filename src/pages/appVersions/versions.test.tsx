import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import appVersionsMock from '../../../mock/appVersions.mock';
import channelsMock from '../../../mock/channels.mock';
import { useMockBackend } from '../../../tests/mockBackend';
import { must } from '../../../tests/must';
import { renderPage } from '../../../tests/renderPage';
import enUS from '../../locales/en-US';
import {
  appVersionsState,
  channelsState,
  chooseOption,
  holdWrites,
  jsonAnswer,
  overrideFetch,
  settled,
  signIn,
  writesOf,
} from './testSetup';
import AppVersionsPage from './versions';

vi.mock('../../request/upload', async () => {
  const base = (await import('./testSetup')).uploadModule;
  return { uploadFile: async (options: { url: string; file: File }) => base.uploadFile(options) };
});

const backend = () => useMockBackend({ default: appVersionsMock }, { default: channelsMock });

beforeEach(() => {
  signIn('root');
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const rows = () => [...document.querySelectorAll('.ant-table-tbody tr.ant-table-row')];
const cellsOf = (tr: Element) => [...tr.querySelectorAll('td')].map((td) => td.textContent ?? '');
const versionBy = (channel: string, code: number) => {
  const found = [...appVersionsState.versions.values()].find(
    (v) => v.channelCode === channel && v.versionCode === code,
  );
  if (!found) throw new Error(`no version ${channel} ${code}`);
  return found;
};
const rowOf = async (id: string) => {
  await waitFor(() => expect(document.querySelector(`tr[data-row-key="${id}"]`)).not.toBeNull());
  return document.querySelector(`tr[data-row-key="${id}"]`) as HTMLTableRowElement;
};
const load = async () => {
  const calls = backend();
  const user = userEvent.setup();
  renderPage(<AppVersionsPage />);
  await waitFor(() => expect(rows().length).toBeGreaterThan(0));
  return { calls, user };
};
const labelsIn = (row: Element) =>
  [...(row.querySelector('td:last-child') as Element).querySelectorAll('button')]
    .map((b) => (b.textContent ?? '').trim())
    .filter(Boolean);
const confirmInline = async (
  user: ReturnType<typeof userEvent.setup>,
  row: Element,
  label: string,
) => {
  await user.click(within(row as HTMLElement).getByRole('button', { name: label }));
  await user.click(await screen.findByRole('button', { name: 'OK' }));
};
const txt = (key: string) => enUS[key];

describe('the page of the app versions', () => {
  it('writes the rule of the decision at the top: the four sentences of the spec, in order', async () => {
    await load();
    const note = screen.getByTestId('appversions-rules');
    const items = [...note.querySelectorAll('li')].map((li) => li.textContent);
    expect(items).toEqual([
      txt('appVersions.rules.none'),
      txt('appVersions.rules.optional'),
      txt('appVersions.rules.forced'),
      txt('appVersions.rules.atMinimum'),
    ]);
    // the note is above the table
    const table = document.querySelector('.ant-table') as Element;
    expect(note.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // the sentences say what the spec says
    expect(items[0]).toMatch(/equal to or higher than the active version.*no prompt/i);
    expect(items[1]).toMatch(
      /between the minimum version number and the active version.*optional/i,
    );
    expect(items[2]).toMatch(/lower than the minimum version number.*forced/i);
    expect(items[3]).toMatch(/equal to the minimum version number.*optional/i);
  });

  it('lists the versions with the columns of the spec, the active ones first', async () => {
    await load();
    const headers = [...document.querySelectorAll('.ant-table-thead th')].map(
      (th) => th.textContent,
    );
    expect(headers).toEqual([
      'Channel package',
      'Platform',
      'Version name',
      'Version number',
      'Minimum version number',
      'Status',
      'Store link or APK',
      'Created by',
      'Activated at',
      'Actions',
    ]);
    const statuses = rows().map((tr) => cellsOf(tr)[5]);
    const firstOther = statuses.findIndex((s) => s !== 'Active');
    expect(statuses.slice(0, firstOther).every((s) => s === 'Active')).toBe(true);
    expect(statuses.slice(firstOther).includes('Active')).toBe(false);
    expect(new Set(statuses)).toEqual(new Set(['Active', 'Draft', 'Archived']));
    const active = await rowOf(versionBy('play', 110).id);
    const cells = cellsOf(active);
    expect(cells[0]).toContain('Android store');
    expect(cells[0]).toContain('play');
    expect(cells.slice(1, 6)).toEqual(['Android', '1.1.0', '110', '100', 'Active']);
    expect(cells[7]).toBe('root');
  });

  it('puts the active versions first on the page even when the backend sent them in another order, and leaves the rest in the order it sent', async () => {
    backend();
    overrideFetch(async ({ url, method }) =>
      method === 'GET' && url.pathname === '/api/admin/app-versions'
        ? jsonAnswer(200, '200', {
            items: [
              {
                id: 'd1',
                channelCode: 'play',
                platform: 'ANDROID',
                versionName: '1.0.1',
                versionCode: 101,
                minVersionCode: 1,
                status: 'DRAFT',
              },
              {
                id: 'a1',
                channelCode: 'play',
                platform: 'ANDROID',
                versionName: '1.0.2',
                versionCode: 102,
                minVersionCode: 1,
                status: 'ARCHIVED',
              },
              {
                id: 'x1',
                channelCode: 'direct',
                platform: 'ANDROID',
                versionName: '1.0.3',
                versionCode: 103,
                minVersionCode: 1,
                status: 'ACTIVE',
              },
              {
                id: 'd2',
                channelCode: 'play',
                platform: 'ANDROID',
                versionName: '1.0.4',
                versionCode: 104,
                minVersionCode: 1,
                status: 'DRAFT',
              },
              {
                id: 'x2',
                channelCode: 'play',
                platform: 'ANDROID',
                versionName: '1.0.5',
                versionCode: 105,
                minVersionCode: 1,
                status: 'ACTIVE',
              },
            ],
            total: 5,
          })
        : undefined,
    );
    renderPage(<AppVersionsPage />);
    await waitFor(() => expect(rows()).toHaveLength(5));
    expect(rows().map((tr) => tr.getAttribute('data-row-key'))).toEqual([
      'x1',
      'x2',
      'd1',
      'a1',
      'd2',
    ]);
  });

  it('shows the store link of a STORE version, and the size and the first 8 characters of the checksum of a DIRECT one', async () => {
    await load();
    const store = await rowOf(versionBy('play', 110).id);
    expect(cellsOf(store)[6]).toContain('play.google.com');
    const direct = versionBy('direct', 110);
    const row = await rowOf(direct.id);
    const cell = cellsOf(row)[6];
    expect(cell).toContain(`SHA-256 ${direct.apkSha256?.slice(0, 8)}`);
    expect(cell).not.toContain(direct.apkSha256 as string);
    expect(cell).toMatch(/MB/);
    expect(cell).not.toContain('http');
  });

  it('turns a link into a link only when it is https, and otherwise shows it as text', async () => {
    const calls = backend();
    const id = versionBy('play', 110).id;
    must(appVersionsState.versions.get(id)).storeUrl = 'javascript:alert(1)';
    renderPage(<AppVersionsPage />);
    const row = await rowOf(id);
    expect(calls.length).toBeGreaterThan(0);
    expect(row.querySelector('a[href^="javascript"]')).toBeNull();
    expect(cellsOf(row)[6]).toContain('javascript:alert(1)');
    const other = await rowOf(versionBy('appstore', 310).id);
    const anchor = other.querySelector('a') as HTMLAnchorElement;
    expect(anchor.getAttribute('href')).toMatch(/^https:\/\/apps\.apple\.com\//);
    expect(anchor.getAttribute('rel')).toContain('noreferrer');
    expect(anchor.getAttribute('target')).toBe('_blank');
  });

  it('shows a dash where there is no activation time or no creator name', async () => {
    await load();
    const draft = await rowOf(versionBy('play', 120).id);
    expect(cellsOf(draft)[8]).toBe('—');
  });

  it('shows the first characters of the id when the administrator is gone, and a dash when there is no id', async () => {
    backend();
    const gone = must(appVersionsState.versions.get(versionBy('play', 120).id));
    gone.createdBy = 'deleted-admin-with-a-long-id';
    const none = must(appVersionsState.versions.get(versionBy('play', 100).id));
    none.createdBy = null;
    renderPage(<AppVersionsPage />);
    expect(cellsOf(await rowOf(gone.id))[7]).toBe('deleted-');
    expect(cellsOf(await rowOf(none.id))[7]).toBe('—');
  });

  it('filters by channel package, platform and status, and sends only the ones that were chosen', async () => {
    const { calls, user } = await load();
    await chooseOption(user, 'Channel package', /Direct download|direct/);
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() =>
      expect(calls.some((c) => c.method === 'GET' && c.url.includes('channelCode=direct'))).toBe(
        true,
      ),
    );
    await waitFor(() => expect(rows().every((tr) => cellsOf(tr)[0].includes('direct'))).toBe(true));
    await chooseOption(user, 'Status', 'Draft');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(rows()).toHaveLength(1));
    const last = calls.filter((c) => c.url.startsWith('/api/admin/app-versions')).at(-1);
    expect(last?.url).toContain('channelCode=direct');
    expect(last?.url).toContain('status=DRAFT');
    expect(last?.url).not.toContain('platform');
  });

  it('asks for the second page when it is chosen', async () => {
    const calls = backend();
    for (let i = 0; i < 25; i += 1) {
      const base = must(appVersionsState.versions.get(versionBy('play', 100).id));
      appVersionsState.versions.set(`extra-${i}`, {
        ...base,
        id: `extra-${i}`,
        versionCode: 1000 + i,
        status: 'ARCHIVED',
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
      });
    }
    const user = userEvent.setup();
    renderPage(<AppVersionsPage />);
    await waitFor(() => expect(rows()).toHaveLength(20));
    await user.click(await screen.findByTitle('2'));
    await waitFor(() => expect(calls.some((c) => c.url.includes('page=2'))).toBe(true));
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    expect(rows().length).toBeLessThan(20);
  });

  it('never lets an old answer replace a newer one', async () => {
    backend();
    let releaseFirst: () => void = () => {};
    const first = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let calls = 0;
    const real = globalThis.fetch;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL, init: RequestInit = {}) => {
        const url = String(input);
        if (url.startsWith('/api/admin/app-versions') && (init.method ?? 'GET') === 'GET') {
          calls += 1;
          if (calls === 1) {
            await first;
          }
        }
        return real(input, init);
      }),
    );
    const user = userEvent.setup();
    renderPage(<AppVersionsPage />);
    await waitFor(() => expect(calls).toBe(1));
    await chooseOption(user, 'Status', 'Archived');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    const before = rows().map((tr) => cellsOf(tr)[5]);
    expect(new Set(before)).toEqual(new Set(['Archived']));
    releaseFirst();
    await settled();
    expect(new Set(rows().map((tr) => cellsOf(tr)[5]))).toEqual(new Set(['Archived']));
  });

  it('says why a read failed with the words of the error code and reads again on retry', async () => {
    backend();
    let fail = true;
    const taken = overrideFetch(async ({ url, method }) =>
      fail && method === 'GET' && url.pathname === '/api/admin/app-versions'
        ? jsonAnswer(500, 'INTERNAL_ERROR', null, 'secret backend words')
        : undefined,
    );
    const user = userEvent.setup();
    renderPage(<AppVersionsPage />);
    expect(await screen.findByText(/Load failed|Failed to load|could not/i)).toBeTruthy();
    expect(screen.queryByText(/secret backend words/)).toBeNull();
    expect(taken.length).toBeGreaterThan(0);
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
  });

  it('does not break on fields of the wrong type, and shows them as text', async () => {
    backend();
    overrideFetch(async ({ url, method }) =>
      method === 'GET' && url.pathname === '/api/admin/app-versions'
        ? jsonAnswer(200, '200', {
            items: [
              {
                id: 7,
                channelCode: { a: 1 },
                platform: 5,
                versionName: 12,
                versionCode: '110',
                minVersionCode: null,
                status: 'ACTIVE',
                storeUrl: { u: 1 },
                changelog: 'text',
                createdByUsername: ['x'],
                activatedAt: 17,
              },
              {
                id: 'b',
                status: 'DRAFT',
                apkSha256: 12345678901234,
                apkSizeBytes: 'big',
                channelCode: 'direct',
              },
              { id: 'c', status: { s: 1 } },
            ],
            total: 3,
          })
        : undefined,
    );
    renderPage(<AppVersionsPage />);
    await waitFor(() => expect(rows()).toHaveLength(3));
    expect(rows()[0].textContent).toContain('12');
    expect(rows()[0].textContent).toContain('110');
  });

  it('holds the names of every language, long unbroken text and emoji without widening the table', async () => {
    backend();
    const long = 'ก'.repeat(5000);
    must(channelsState.channels.get('play')).name = long;
    must(channelsState.channels.get('direct')).name = 'مرحبا بك في التطبيق 🌟 Xin chào Hola';
    must(channelsState.channels.get('appstore')).name = '😀'.repeat(300);
    renderPage(<AppVersionsPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    for (const pattern of [/^ก+$/, /^مرحبا بك/, /^(😀)+$/u]) {
      const names = await screen.findAllByText(pattern, { selector: 'button' });
      expect(names.length).toBeGreaterThan(0);
      for (const name of names) {
        const style = getComputedStyle(name);
        expect(style.overflowWrap).toBe('anywhere');
        expect(style.maxWidth).toBe('200px');
        expect(name.getAttribute('data-lines')).toBe('2');
      }
    }
    // the whole text is one click away and nothing was cut from it
    expect((await screen.findAllByText(long, { selector: 'button' }))[0].textContent).toHaveLength(
      5000,
    );
    // the table scrolls inside its own box
    expect(document.querySelector('.ant-table-content')).not.toBeNull();
  });
});

describe('who sees which button', () => {
  const codes = (list: string[]) => signIn('support', { codes: list });

  it('shows the new-version button, edit and delete only with APPVERSION:MANAGE', async () => {
    codes(['APPVERSION:VIEW']);
    await load();
    expect(screen.queryByRole('button', { name: 'New version' })).toBeNull();
    for (const row of rows()) expect(labelsIn(row)).toEqual([]);
    document.body.innerHTML = '';
    codes(['APPVERSION:VIEW', 'APPVERSION:MANAGE']);
    await load();
    expect(screen.getByRole('button', { name: 'New version' })).toBeTruthy();
    const draft = await rowOf(versionBy('play', 120).id);
    expect(labelsIn(draft)).toEqual(['Edit', 'Delete']);
    const active = await rowOf(versionBy('play', 110).id);
    expect(labelsIn(active)).toEqual([]);
  });

  it('shows activate and take down only with APPVERSION:ACTIVATE', async () => {
    codes(['APPVERSION:VIEW', 'APPVERSION:ACTIVATE']);
    await load();
    expect(screen.queryByRole('button', { name: 'New version' })).toBeNull();
    expect(labelsIn(await rowOf(versionBy('play', 120).id))).toEqual(['Activate']);
    expect(labelsIn(await rowOf(versionBy('play', 110).id))).toEqual(['Take down']);
  });

  it('gives a draft edit, activate and delete, an active version take down, and an archived version nothing', async () => {
    await load();
    expect(labelsIn(await rowOf(versionBy('play', 120).id))).toEqual([
      'Edit',
      'Activate',
      'Delete',
    ]);
    expect(labelsIn(await rowOf(versionBy('play', 110).id))).toEqual(['Take down']);
    const archived = await rowOf(versionBy('play', 100).id);
    expect(labelsIn(archived)).toEqual([]);
    expect(cellsOf(archived)[9]).toBe('—');
  });
});

describe('deleting a draft and taking a version down', () => {
  it('asks first, then deletes the draft with one request', async () => {
    const { calls, user } = await load();
    const draft = versionBy('play', 120);
    const row = await rowOf(draft.id);
    await user.click(within(row).getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('Delete this draft?')).toBeTruthy();
    expect(writesOf(calls)).toHaveLength(0);
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    await waitFor(() => expect(appVersionsState.versions.has(draft.id)).toBe(false));
    expect(writesOf(calls).map((c) => [c.method, c.url])).toEqual([
      ['DELETE', `/api/admin/app-versions/${draft.id}`],
    ]);
    await waitFor(() =>
      expect(document.querySelector(`tr[data-row-key="${draft.id}"]`)).toBeNull(),
    );
  });

  it('sends one request when the confirmation is pressed twice', async () => {
    const { calls, user } = await load();
    const draft = versionBy('play', 120);
    const row = await rowOf(draft.id);
    await user.click(within(row).getByRole('button', { name: 'Delete' }));
    const ok = await screen.findByRole('button', { name: 'OK' });
    const hold = holdWrites();
    await user.click(ok);
    fireEvent.click(ok);
    await settled();
    expect(hold.started()).toBe(1);
    hold.release();
    await waitFor(() => expect(appVersionsState.versions.has(draft.id)).toBe(false));
    expect(writesOf(calls)).toHaveLength(1);
  });

  it('sends one request when the confirmation is pressed twice in the same instant', async () => {
    const { calls, user } = await load();
    const draft = versionBy('play', 120);
    const row = await rowOf(draft.id);
    await user.click(within(row).getByRole('button', { name: 'Delete' }));
    const ok = await screen.findByRole('button', { name: 'OK' });
    const hold = holdWrites();
    act(() => {
      fireEvent.click(ok);
      fireEvent.click(ok);
    });
    await settled();
    expect(hold.started()).toBe(1);
    hold.release();
    await waitFor(() => expect(appVersionsState.versions.has(draft.id)).toBe(false));
    expect(writesOf(calls)).toHaveLength(1);
  });

  it('takes the active version down after the question of the spec, with one request', async () => {
    const { calls, user } = await load();
    const active = versionBy('play', 110);
    const row = await rowOf(active.id);
    await user.click(within(row).getByRole('button', { name: 'Take down' }));
    expect(
      await screen.findByText(
        'After it is taken down, this channel will no longer prompt users to update',
      ),
    ).toBeTruthy();
    expect(writesOf(calls)).toHaveLength(0);
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    await waitFor(() => expect(appVersionsState.versions.get(active.id)?.status).toBe('ARCHIVED'));
    expect(writesOf(calls).map((c) => [c.method, c.url, c.body])).toEqual([
      ['PUT', `/api/admin/app-versions/${active.id}/status`, { status: 'ARCHIVED' }],
    ]);
  });

  it('says why in the words of the error code when the backend refuses, and keeps the row', async () => {
    const { user } = await load();
    const draft = versionBy('play', 120);
    const row = await rowOf(draft.id);
    // somebody else activated it meanwhile
    must(appVersionsState.versions.get(draft.id)).status = 'ARCHIVED';
    await confirmInline(user, row, 'Delete');
    expect(await screen.findByText(txt('error.INVALID_STATE'))).toBeTruthy();
    expect(appVersionsState.versions.has(draft.id)).toBe(true);
  });
});

describe('the Chinese page', () => {
  it('shows the rule, the headers and the buttons in Chinese', async () => {
    backend();
    renderPage(<AppVersionsPage />, 'zh-CN');
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    const note = screen.getByTestId('appversions-rules');
    expect(note.textContent).toContain('等于或高于生效版本');
    expect(note.textContent).toContain('强制更新');
    expect(document.querySelector('.ant-table-thead')?.textContent).toContain('最低版本号');
    expect(screen.getByRole('button', { name: '新建版本' })).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/appVersions\./);
  });
});
