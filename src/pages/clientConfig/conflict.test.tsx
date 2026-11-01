import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { simulateOtherAdminEdit } from '../../../mock/_core/clientConfigData';
import clientConfigMock from '../../../mock/clientConfig.mock';
import configMock from '../../../mock/config.mock';
import { envelope, jsonResponse } from '../../../tests/httpStubs';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import ClientConfigPage from './list';
import { clientConfigState, signIn, writesOf } from './testSetup';

vi.setConfig({ testTimeout: 30000 });

beforeEach(() => signIn('root'));
afterEach(() => vi.unstubAllGlobals());

const backend = () => useMockBackend({ default: clientConfigMock }, { default: configMock });
const tableRows = () => [
  ...document.querySelectorAll<HTMLElement>('.ant-table-tbody tr.ant-table-row'),
];
const rowOf = (key: string) =>
  tableRows().find((tr) => tr.querySelector('td')?.textContent?.startsWith(key)) as HTMLElement;

async function openKey(user: ReturnType<typeof userEvent.setup>, key: string) {
  await waitFor(() => expect(tableRows().length).toBe(19));
  await user.click(within(rowOf(key)).getByRole('button', { name: /Edit|View/ }));
  return screen.findByRole('dialog');
}
const valueBox = (drawer: HTMLElement, language = 'Default') =>
  within(drawer).getByRole('textbox', { name: `Value (${language})` });
const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });
const save = (drawer: HTMLElement) => within(drawer).getByRole('button', { name: /Save$/ });
const puts = (calls: { method: string; body?: unknown }[]) =>
  calls.filter((c) => c.method === 'PUT');
const THEIRS_TH = 'ใช้ลิงก์ใหม่ของเพื่อน';
const ARABIC_TITLE = ['\u0627\u0646\u0636\u0645', '\u0625\u0644\u064a', '\u{1F600}'].join(' ');

/** Replaces `fetch` from now on: a GET of the list is answered by `answer`, or by the mock backend when it gives undefined. */
function interceptListRead(answer: () => Response | undefined) {
  const mocked = globalThis.fetch;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL, init: RequestInit = {}) => {
      const isListRead =
        (init.method ?? 'GET').toUpperCase() === 'GET' &&
        String(input).endsWith('/api/admin/client-config');
      return (isListRead ? answer() : undefined) ?? mocked(input, init);
    }),
  );
}

describe('saving a key another administrator changed after the editor opened', () => {
  it('sends nothing, says it was changed by someone else, keeps what was typed, and leaves their values in place', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    const drawer = await openKey(user, 'privacyPolicyUrl');
    type(valueBox(drawer), 'https://example.com/mine');
    simulateOtherAdminEdit('privacyPolicyUrl', {
      '': 'https://example.com/theirs',
      th: THEIRS_TH,
      ja: 'https://example.com/ja/theirs',
    });
    const theirs = JSON.stringify([...(clientConfigState.rows.get('privacyPolicyUrl') ?? [])]);
    await user.click(save(drawer));
    expect(await within(drawer).findByText('Modified by someone else')).toBeInTheDocument();
    expect(within(drawer).getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    expect(puts(calls)).toHaveLength(0);
    expect((valueBox(drawer) as HTMLInputElement).value).toBe('https://example.com/mine');
    expect(JSON.stringify([...(clientConfigState.rows.get('privacyPolicyUrl') ?? [])])).toBe(
      theirs,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('shows their version on Reload, drops what was typed, and the next save keeps the language they added', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    const drawer = await openKey(user, 'inviteShareTitle');
    type(valueBox(drawer), 'my own title');
    simulateOtherAdminEdit('inviteShareTitle', {
      '': 'Join me 🎉',
      th: THEIRS_TH,
      ar: ARABIC_TITLE,
      ja: 'アプリで会いましょう',
    });
    await user.click(save(drawer));
    await user.click(await within(drawer).findByRole('button', { name: 'Reload' }));
    await waitFor(() => expect(within(drawer).queryByText('Modified by someone else')).toBeNull());
    expect((valueBox(drawer) as HTMLInputElement).value).toBe('Join me 🎉');
    expect(
      within(drawer)
        .getAllByRole('tab')
        .map((tab) => tab.textContent),
    ).toEqual(['Default', 'ar', 'ja', 'th']);
    expect(save(drawer)).toBeDisabled();
    type(valueBox(drawer), 'Join me, edited');
    await user.click(save(drawer));
    await waitFor(() => expect(puts(calls)).toHaveLength(1));
    expect(puts(calls)[0].body).toEqual({
      values: {
        '': 'Join me, edited',
        th: THEIRS_TH,
        ar: ARABIC_TITLE,
        ja: 'アプリで会いましょう',
      },
    });
  });

  it('is a conflict also when the other administrator reset the key, or configured a key that had no value', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    const drawer = await openKey(user, 'privacyPolicyUrl');
    type(valueBox(drawer), 'https://example.com/mine');
    clientConfigState.rows.delete('privacyPolicyUrl');
    await user.click(save(drawer));
    expect(await within(drawer).findByText('Modified by someone else')).toBeInTheDocument();
    expect(puts(calls)).toHaveLength(0);
  });

  it('is a conflict for a key that had no value when someone gave it one', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    const drawer = await openKey(user, 'supportUrl');
    await user.click(within(drawer).getByRole('button', { name: 'Add the default value' }));
    type(valueBox(drawer), 'https://example.com/mine');
    simulateOtherAdminEdit('supportUrl', { '': 'https://example.com/theirs' });
    await user.click(save(drawer));
    expect(await within(drawer).findByText('Modified by someone else')).toBeInTheDocument();
    expect(puts(calls)).toHaveLength(0);
  });
});

describe('saving a key nobody else changed', () => {
  it('reads the key again first and then sends the one write; no notice of a conflict', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    const drawer = await openKey(user, 'privacyPolicyUrl');
    type(valueBox(drawer), 'https://example.com/mine');
    const readsBefore = calls.filter((c) => c.method === 'GET').length;
    await user.click(save(drawer));
    await waitFor(() => expect(puts(calls)).toHaveLength(1));
    const order = calls.map((c) => c.method);
    expect(order.slice(readsBefore)).toEqual(['GET', 'PUT', 'GET']);
    expect(screen.queryByText('Modified by someone else')).toBeNull();
    expect(await screen.findByText('Saved')).toBeInTheDocument();
  });

  it('sends one write and one check when Save is pressed three times at once', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    const drawer = await openKey(user, 'privacyPolicyUrl');
    type(valueBox(drawer), 'https://example.com/mine');
    const readsBefore = calls.filter((c) => c.method === 'GET').length;
    const button = save(drawer);
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(puts(calls)).toHaveLength(1));
    await new Promise((r) => setTimeout(r, 100));
    expect(puts(calls)).toHaveLength(1);
    // The check before the write is one read; the one after the save is the list reloading.
    expect(calls.filter((c) => c.method === 'GET').length - readsBefore).toBe(2);
  });
});

describe('the reload offered after a conflict', () => {
  /** A save is refused by the backend for the language `th`, then another administrator changes the key, then Save meets the conflict. */
  async function toTheConflict(user: ReturnType<typeof userEvent.setup>) {
    const mocked = globalThis.fetch;
    let refuse = true;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL, init: RequestInit = {}) =>
        refuse && (init.method ?? 'GET').toUpperCase() === 'PUT'
          ? jsonResponse(
              400,
              envelope('INVALID_REQUEST', { details: [{ ref: 'th', reason: 'TOO_LONG' }] }),
            )
          : mocked(input, init),
      ),
    );
    renderPage(<ClientConfigPage />);
    const drawer = await openKey(user, 'privacyPolicyUrl');
    type(valueBox(drawer), 'https://example.com/mine');
    await user.click(save(drawer));
    expect(
      await within(drawer).findByRole('tab', { name: /th.*has an error/ }),
    ).toBeInTheDocument();
    refuse = false;
    await user.click(within(drawer).getByRole('tab', { name: /^Default/ }));
    simulateOtherAdminEdit('privacyPolicyUrl', {
      '': 'https://example.com/theirs',
      th: 'https://example.com/th/theirs',
    });
    type(valueBox(drawer), 'https://example.com/mine-again');
    await user.click(save(drawer));
    await within(drawer).findByText('Modified by someone else');
    return drawer;
  }

  it('reads the key and then lets the list read again, so the list shows their version too', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    const drawer = await openKey(user, 'privacyPolicyUrl');
    type(valueBox(drawer), 'https://example.com/mine');
    simulateOtherAdminEdit('privacyPolicyUrl', { '': 'https://example.com/theirs' });
    await user.click(save(drawer));
    await user.click(await within(drawer).findByRole('button', { name: 'Reload' }));
    await waitFor(() => expect(within(drawer).queryByText('Modified by someone else')).toBeNull());
    const readsBefore = calls.filter((c) => c.method === 'GET').length;
    // (the check of the save is already counted: the reload is one read of the key and one of the list)
    type(valueBox(drawer), 'https://example.com/x');
    expect(readsBefore).toBeGreaterThan(0);
    const listReads = calls.filter(
      (c) => c.method === 'GET' && c.url.endsWith('/api/admin/client-config'),
    ).length;
    // opening: 1 (list) ; the check of the save: 1 ; the reload: 1 for the key and 1 for the list
    expect(listReads).toBe(4);
  });

  it('takes the red marks of the languages away together with the edit', async () => {
    backend();
    const user = userEvent.setup();
    const drawer = await toTheConflict(user);
    await user.click(within(drawer).getByRole('button', { name: 'Reload' }));
    await waitFor(() => expect(within(drawer).queryByText('Modified by someone else')).toBeNull());
    expect(within(drawer).queryByRole('tab', { name: /has an error/ })).toBeNull();
    expect(
      within(drawer).queryByText('The backend did not accept it; the whole key was not saved.'),
    ).toBeNull();
  });

  it('says in the words of the error when the key cannot be read, and keeps what was typed', async () => {
    backend();
    const user = userEvent.setup();
    const drawer = await toTheConflict(user);
    interceptListRead(() => jsonResponse(500, envelope('INTERNAL_ERROR', null, 'raw words')));
    await user.click(within(drawer).getByRole('button', { name: 'Reload' }));
    expect(
      await within(drawer).findByText('Server error. Please try again later.'),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('raw words');
    expect((valueBox(drawer) as HTMLInputElement).value).toBe('https://example.com/mine-again');
  });
});

describe('a save and a reset of the same key', () => {
  it('do not run together: while the reset checks the key, Save is off and a press of it sends nothing', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    const drawer = await openKey(user, 'privacyPolicyUrl');
    type(valueBox(drawer), 'https://example.com/mine');
    const mocked = globalThis.fetch;
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL, init: RequestInit = {}) => {
        if (
          (init.method ?? 'GET').toUpperCase() === 'GET' &&
          String(input).endsWith('/api/admin/client-config')
        ) {
          await gate;
        }
        return mocked(input, init);
      }),
    );
    await user.click(within(drawer).getByRole('button', { name: 'Reset' }));
    fireEvent.click(await screen.findByRole('button', { name: 'OK' }));
    await waitFor(() => expect(save(drawer)).toBeDisabled());
    fireEvent.click(save(drawer));
    await new Promise((r) => setTimeout(r, 100));
    release();
    await screen.findByText('Reset done');
    expect(puts(calls)).toHaveLength(0);
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(1);
  });
});

describe('when the key cannot be read again', () => {
  it('sends nothing and shows the words of the error, keeping the edit', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    const drawer = await openKey(user, 'privacyPolicyUrl');
    type(valueBox(drawer), 'https://example.com/mine');
    interceptListRead(() => jsonResponse(403, envelope('ADMIN_FORBIDDEN', null, 'raw words')));
    await user.click(save(drawer));
    expect(await within(drawer).findByText(/You do not have permission/)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('raw words');
    expect(puts(calls)).toHaveLength(0);
    expect((valueBox(drawer) as HTMLInputElement).value).toBe('https://example.com/mine');
    expect(within(drawer).queryByText('Modified by someone else')).toBeNull();
  });

  it('is a conflict when the answer no longer has the key', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    const drawer = await openKey(user, 'privacyPolicyUrl');
    type(valueBox(drawer), 'https://example.com/mine');
    interceptListRead(() => jsonResponse(200, envelope('200', { items: [] })));
    await user.click(save(drawer));
    expect(await within(drawer).findByText('Modified by someone else')).toBeInTheDocument();
    expect(puts(calls)).toHaveLength(0);
  });
});

describe('a backend that sends no time for the key', () => {
  const SEEDED = {
    '': 'https://example.com/privacy',
    th: 'https://example.com/th/privacy',
    ar: 'https://example.com/ar/privacy',
    'zh-Hans': 'https://example.com/zh/privacy',
  };
  const withoutTime = (rows: Record<string, unknown>) => () =>
    jsonResponse(
      200,
      envelope('200', {
        items: [
          {
            key: 'privacyPolicyUrl',
            type: 'URL',
            localized: true,
            readOnly: false,
            configured: true,
            defaultValue: null,
            values: rows,
          },
        ],
      }),
    );

  it('compares the values: the same values save', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    const drawer = await openKey(user, 'privacyPolicyUrl');
    type(valueBox(drawer), 'https://example.com/mine');
    interceptListRead(withoutTime(SEEDED));
    await user.click(save(drawer));
    await waitFor(() => expect(puts(calls)).toHaveLength(1));
    expect(screen.queryByText('Modified by someone else')).toBeNull();
  });

  it('compares the values: other values are a conflict', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    const drawer = await openKey(user, 'privacyPolicyUrl');
    type(valueBox(drawer), 'https://example.com/mine');
    interceptListRead(withoutTime({ ...SEEDED, th: 'https://example.com/th/theirs' }));
    await user.click(save(drawer));
    expect(await within(drawer).findByText('Modified by someone else')).toBeInTheDocument();
    expect(puts(calls)).toHaveLength(0);
  });
});

describe('resetting a key another administrator changed after the editor opened', () => {
  const reset = async (drawer: HTMLElement, user: ReturnType<typeof userEvent.setup>) => {
    await user.click(within(drawer).getByRole('button', { name: 'Reset' }));
    // The popup of a first confirmation may still be fading out (no animation end in the test
    // DOM), and then its button still carries the loading icon in its name.
    await user.click(await screen.findByRole('button', { name: /OK$/ }));
  };

  it('sends nothing, says it was changed by someone else, and leaves their values in place', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    const drawer = await openKey(user, 'privacyPolicyUrl');
    simulateOtherAdminEdit('privacyPolicyUrl', {
      '': 'https://example.com/theirs',
      th: THEIRS_TH,
      ar: ARABIC_TITLE,
    });
    const theirs = JSON.stringify([...(clientConfigState.rows.get('privacyPolicyUrl') ?? [])]);
    await reset(drawer, user);
    expect(await within(drawer).findByText('Modified by someone else')).toBeInTheDocument();
    expect(within(drawer).getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
    expect(JSON.stringify([...(clientConfigState.rows.get('privacyPolicyUrl') ?? [])])).toBe(
      theirs,
    );
    expect(screen.queryByText('Reset done')).toBeNull();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('shows their version on Reload, and a second reset then goes through', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    const drawer = await openKey(user, 'inviteShareTitle');
    simulateOtherAdminEdit('inviteShareTitle', { '': 'Join me 🎉', th: THEIRS_TH });
    await reset(drawer, user);
    await user.click(await within(drawer).findByRole('button', { name: 'Reload' }));
    await waitFor(() => expect(within(drawer).queryByText('Modified by someone else')).toBeNull());
    expect((valueBox(drawer) as HTMLInputElement).value).toBe('Join me 🎉');
    expect(writesOf(calls)).toHaveLength(0);
    await reset(drawer, user);
    await screen.findByText('Reset done');
    expect(writesOf(calls)).toHaveLength(1);
    expect(clientConfigState.rows.has('inviteShareTitle')).toBe(false);
  });

  it('is a conflict when the other administrator reset the key first', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    const drawer = await openKey(user, 'privacyPolicyUrl');
    clientConfigState.rows.delete('privacyPolicyUrl');
    await reset(drawer, user);
    expect(await within(drawer).findByText('Modified by someone else')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('is a conflict when the answer no longer has the key', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    const drawer = await openKey(user, 'privacyPolicyUrl');
    interceptListRead(() => jsonResponse(200, envelope('200', { items: [] })));
    await reset(drawer, user);
    expect(await within(drawer).findByText('Modified by someone else')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
  });
});

describe('resetting a key nobody else changed', () => {
  it('reads the key again first and then sends the one reset; no notice of a conflict', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    const drawer = await openKey(user, 'privacyPolicyUrl');
    const readsBefore = calls.filter((c) => c.method === 'GET').length;
    await user.click(within(drawer).getByRole('button', { name: 'Reset' }));
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    await screen.findByText('Reset done');
    expect(calls.map((c) => c.method).slice(readsBefore)).toEqual(['GET', 'POST', 'GET']);
    expect(screen.queryByText('Modified by someone else')).toBeNull();
  });

  it('sends one check and one reset when the confirmation is pressed three times at once', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    const drawer = await openKey(user, 'privacyPolicyUrl');
    const readsBefore = calls.filter((c) => c.method === 'GET').length;
    await user.click(within(drawer).getByRole('button', { name: 'Reset' }));
    const ok = await screen.findByRole('button', { name: 'OK' });
    fireEvent.click(ok);
    fireEvent.click(ok);
    fireEvent.click(ok);
    await screen.findByText('Reset done');
    await new Promise((r) => setTimeout(r, 100));
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(1);
    // The check before the reset is one read; the one after is the list reloading.
    expect(calls.filter((c) => c.method === 'GET').length - readsBefore).toBe(2);
  });
});

describe('when the key cannot be read again before a reset', () => {
  it('sends nothing and shows the words of the error', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    const drawer = await openKey(user, 'privacyPolicyUrl');
    interceptListRead(() => jsonResponse(403, envelope('ADMIN_FORBIDDEN', null, 'raw words')));
    await user.click(within(drawer).getByRole('button', { name: 'Reset' }));
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    expect(await within(drawer).findByText(/You do not have permission/)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('raw words');
    expect(writesOf(calls)).toHaveLength(0);
    expect(within(drawer).queryByText('Modified by someone else')).toBeNull();
    expect(screen.queryByText('Reset done')).toBeNull();
  });
});
