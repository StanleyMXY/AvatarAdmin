import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import channelsMock from '../../../mock/channels.mock';
import { useMockBackend } from '../../../tests/mockBackend';
import { must } from '../../../tests/must';
import { renderPage } from '../../../tests/renderPage';
import enUS from '../../locales/en-US';
import {
  channelsState,
  holdWrites,
  jsonAnswer,
  overrideFetch,
  settled,
  signIn,
  writesOf,
} from '../appVersions/testSetup';
import ChannelsPage from './channels';

const backend = () => useMockBackend({ default: channelsMock });

beforeEach(() => {
  signIn('root');
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const rows = () => [...document.querySelectorAll<HTMLElement>('.ant-table-tbody tr.ant-table-row')];
const cellsOf = (tr: Element) => [...tr.querySelectorAll('td')].map((td) => td.textContent ?? '');
const rowOf = async (code: string) => {
  await waitFor(() => expect(document.querySelector(`tr[data-row-key="${code}"]`)).not.toBeNull());
  return document.querySelector(`tr[data-row-key="${code}"]`) as HTMLTableRowElement;
};
const load = async () => {
  const calls = backend();
  const user = userEvent.setup();
  renderPage(<ChannelsPage />);
  await waitFor(() => expect(rows().length).toBeGreaterThan(0));
  return { calls, user };
};
const dialog = () => screen.findByRole('dialog');
// A button that has been working keeps the name of its spinner (happy-dom never ends the animation).
const submit = (form: ReturnType<typeof within>) =>
  form.getByRole('button', { name: /^(loading )?Submit$/ });
const openNew = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'New channel package' }));
  return within(await dialog());
};
const pick = async (
  user: ReturnType<typeof userEvent.setup>,
  form: ReturnType<typeof within>,
  label: string,
  option: string | RegExp,
) => {
  await user.click(form.getByRole('combobox', { name: label }));
  const options = await screen.findAllByText(option, {
    selector: '.ant-select-item-option-content',
  });
  await user.click(options[options.length - 1]);
};
const fillNew = async (
  user: ReturnType<typeof userEvent.setup>,
  form: ReturnType<typeof within>,
  over: {
    code?: string;
    name?: string;
    pkg?: string;
    platform?: string;
    distribution?: string;
  } = {},
) => {
  await user.type(form.getByRole('textbox', { name: 'Channel code' }), over.code ?? 'partner-th');
  await user.type(form.getByRole('textbox', { name: 'Name' }), over.name ?? 'พันธมิตร Thai');
  await pick(user, form, 'Platform', over.platform ?? 'Android');
  await pick(user, form, 'Distribution', over.distribution ?? 'Direct download');
  if (over.pkg !== '')
    await user.type(
      form.getByRole('textbox', { name: 'Package name' }),
      over.pkg ?? 'com.example.partner',
    );
};

describe('the list of channel packages', () => {
  it('has the columns of the spec and one row for each channel', async () => {
    await load();
    expect(
      [...document.querySelectorAll('.ant-table-thead th')].map((th) => th.textContent),
    ).toEqual([
      'Channel code',
      'Name',
      'Platform',
      'Distribution',
      'Package name',
      'Enabled',
      'Created at',
      'Actions',
    ]);
    expect(rows().map((tr) => cellsOf(tr)[0])).toEqual(['play', 'direct', 'appstore']);
    const play = cellsOf(await rowOf('play'));
    expect(play.slice(0, 5)).toEqual([
      'play',
      'Android store',
      'Android',
      'Store',
      'app.example.play',
    ]);
    expect(cellsOf(await rowOf('direct'))[3]).toBe('Direct download');
    expect(cellsOf(await rowOf('appstore'))[2]).toBe('iOS');
    expect(cellsOf(await rowOf('appstore'))[4]).toBe('—');
    expect(cellsOf(await rowOf('play'))[6]).toMatch(/2026/);
  });

  it('has an enabled switch for each channel and no delete anywhere', async () => {
    await load();
    for (const row of rows()) {
      expect(within(row).getByRole('switch')).toBeTruthy();
      expect(
        [...row.querySelectorAll('button')].map((b) => b.textContent?.trim()).filter(Boolean),
      ).not.toContain('Delete');
    }
    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull();
    expect(
      (await rowOf('play')).querySelector('[role="switch"]')?.getAttribute('aria-checked'),
    ).toBe('true');
  });

  it('says what a channel package is and that there is no delete', async () => {
    await load();
    expect(screen.getByText(enUS['channels.note'])).toBeTruthy();
  });

  it('shows the names of every language, long unbroken text and emoji without widening the table', async () => {
    backend();
    must(channelsState.channels.get('play')).name = 'ก'.repeat(5000);
    must(channelsState.channels.get('direct')).name = 'مرحبا بك 🌟 Xin chào';
    must(channelsState.channels.get('appstore')).packageName = 'a'.repeat(3000);
    renderPage(<ChannelsPage />);
    await waitFor(() => expect(rows().length).toBe(3));
    for (const pattern of [/^ก+$/, /^مرحبا بك/, /^a+$/]) {
      const found = await screen.findAllByText(pattern, { selector: 'button' });
      for (const el of found) {
        expect(getComputedStyle(el).overflowWrap).toBe('anywhere');
        expect(el.getAttribute('data-lines')).toBe('2');
      }
    }
  });

  it('does not break on fields of the wrong type', async () => {
    backend();
    overrideFetch(async ({ url, method }) =>
      method === 'GET' && url.pathname === '/api/admin/channels'
        ? jsonAnswer(200, '200', {
            items: [
              {
                code: 'a1',
                name: 7,
                platform: 5,
                distribution: null,
                packageName: { x: 1 },
                enabled: 'yes',
                createdAt: 17,
              },
              {
                code: 'b2',
                name: ['x'],
                platform: 'ANDROID',
                distribution: 'STORE',
                packageName: 12,
                enabled: true,
              },
              { name: 'no code' },
              null,
            ],
          })
        : undefined,
    );
    renderPage(<ChannelsPage />);
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(cellsOf(rows()[0])[1]).toBe('7');
  });

  it('says why a read failed with the words of the error code, and reads again on retry', async () => {
    backend();
    let fail = true;
    overrideFetch(async ({ url, method }) =>
      fail && method === 'GET' && url.pathname === '/api/admin/channels'
        ? jsonAnswer(500, 'INTERNAL_ERROR', null, 'secret backend words')
        : undefined,
    );
    const user = userEvent.setup();
    renderPage(<ChannelsPage />);
    expect(await screen.findByText(/Failed to load|Load failed|could not/i)).toBeTruthy();
    expect(screen.queryByText(/secret backend words/)).toBeNull();
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(rows().length).toBe(3));
  });
});

describe('who can write', () => {
  it('has the new button, the edit buttons and working switches only with CHANNEL:MANAGE', async () => {
    signIn('support', { codes: ['APPVERSION:VIEW'] });
    await load();
    expect(screen.queryByRole('button', { name: 'New channel package' })).toBeNull();
    for (const row of rows()) {
      expect(within(row).queryByRole('button', { name: 'Edit' })).toBeNull();
      expect(within(row).getByRole('switch')).toBeDisabled();
    }
  });

  it('gives each row Edit and a switch that works with CHANNEL:MANAGE', async () => {
    signIn('support', { codes: ['CHANNEL:MANAGE'] });
    await load();
    expect(screen.getByRole('button', { name: 'New channel package' })).toBeTruthy();
    const row = await rowOf('play');
    expect(within(row).getByRole('button', { name: 'Edit' })).toBeTruthy();
    expect(within(row).getByRole('switch')).not.toBeDisabled();
  });
});

describe('creating a channel package', { timeout: 60000 }, () => {
  it('opens empty and says that the code, the platform and the distribution cannot be changed afterwards', async () => {
    const { user } = await load();
    const form = await openNew(user);
    expect(form.getByRole('textbox', { name: 'Channel code' })).toHaveValue('');
    expect(form.getByText(enUS['channels.codeHelp'])).toBeTruthy();
    expect(form.getAllByText(enUS['channels.fixedHelp']).length).toBeGreaterThan(0);
  });

  it('creates with the five fields, trimmed, and the list shows the new channel', async () => {
    const { calls, user } = await load();
    const form = await openNew(user);
    await fillNew(user, form, { name: '  พันธมิตร Thai 🚀  ', pkg: '  com.example.partner  ' });
    await user.click(submit(form));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0]).toMatchObject({ method: 'POST', url: '/api/admin/channels' });
    expect(writesOf(calls)[0].body).toEqual({
      code: 'partner-th',
      name: 'พันธมิตร Thai 🚀',
      platform: 'ANDROID',
      distribution: 'DIRECT',
      packageName: 'com.example.partner',
    });
    await waitFor(() => expect(rows().map((tr) => cellsOf(tr)[0])).toContain('partner-th'));
    expect(await screen.findByText('Channel package partner-th was created')).toBeTruthy();
  });

  it('sends the package name as null when it is left empty', async () => {
    const { calls, user } = await load();
    const form = await openNew(user);
    await fillNew(user, form, { pkg: '' });
    await user.click(submit(form));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect((writesOf(calls)[0].body as { packageName: unknown }).packageName).toBeNull();
  });

  it('sends one request when Submit is pressed twice', async () => {
    const { calls, user } = await load();
    const form = await openNew(user);
    await fillNew(user, form);
    const hold = holdWrites();
    await user.click(submit(form));
    fireEvent.click(submit(form));
    fireEvent.submit(document.querySelector('form') as HTMLFormElement);
    await settled();
    expect(hold.started()).toBe(1);
    hold.release();
    await waitFor(() => expect(rows().map((tr) => cellsOf(tr)[0])).toContain('partner-th'));
    expect(writesOf(calls)).toHaveLength(1);
  });

  it('checks the code against ^[a-z0-9_-]{2,32}$ and the reserved word, and sends nothing', async () => {
    const { calls, user } = await load();
    const form = await openNew(user);
    await fillNew(user, form, { code: 'A' });
    await user.click(submit(form));
    expect(await form.findByText(enUS['channels.rule.code'])).toBeTruthy();
    const code = form.getByRole('textbox', { name: 'Channel code' });
    for (const bad of ['a', 'Upper', 'has space', 'x'.repeat(33), 'ก-ข', 'a.b']) {
      await user.clear(code);
      await user.type(code, bad);
      await user.click(submit(form));
      await waitFor(() => expect(form.getByText(enUS['channels.rule.code'])).toBeTruthy());
    }
    await user.clear(code);
    await user.type(code, 'unknown');
    await user.click(submit(form));
    expect(await form.findByText(enUS['channels.rule.codeReserved'])).toBeTruthy();
    expect(writesOf(calls)).toHaveLength(0);
    // the two ends of the length are fine
    for (const good of ['ab', 'x'.repeat(32), 'a_b-c9']) {
      await user.clear(code);
      await user.type(code, good);
      await waitFor(() => expect(form.queryByText(enUS['channels.rule.code'])).toBeNull());
    }
  });

  it('does not send a code that exists already, and says so beside the code (it would be refused; nothing is overwritten)', async () => {
    const { calls, user } = await load();
    const form = await openNew(user);
    await fillNew(user, form, { code: 'play' });
    await user.click(submit(form));
    expect(await form.findByText(enUS['channels.rule.codeExists'])).toBeTruthy();
    expect(writesOf(calls)).toHaveLength(0);
    expect(channelsState.channels.get('play')?.name).toBe('Android store');
  });

  it('refuses a code that was made by somebody else meanwhile with the words of the error, beside the code', async () => {
    const { user } = await load();
    const form = await openNew(user);
    await fillNew(user, form);
    channelsState.channels.set('partner-th', {
      ...must(channelsState.channels.get('play')),
      code: 'partner-th',
    });
    await user.click(submit(form));
    // The same sentence is also in the bar at the top of the dialog, which comes first: wait for
    // the one under the field itself.
    await waitFor(() => {
      const field = form
        .getAllByText(enUS['error.DUPLICATE_RESOURCE'])
        .map((m) => m.closest('.ant-form-item'))
        .find((item) => item?.querySelector('input#channelPackage_code'));
      expect(field).toBeTruthy();
    });
  });

  it('wants a name, a platform and a distribution', async () => {
    const { calls, user } = await load();
    const form = await openNew(user);
    await user.type(form.getByRole('textbox', { name: 'Channel code' }), 'ab');
    await user.click(submit(form));
    expect(await form.findByText(enUS['channels.rule.nameRequired'])).toBeTruthy();
    expect(form.getByText(enUS['channels.rule.platformRequired'])).toBeTruthy();
    expect(form.getByText(enUS['channels.rule.distributionRequired'])).toBeTruthy();
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('does not offer a direct download for iOS, and drops it when iOS is chosen after it', async () => {
    const { calls, user } = await load();
    const form = await openNew(user);
    await pick(user, form, 'Platform', 'Android');
    await pick(user, form, 'Distribution', 'Direct download');
    await pick(user, form, 'Platform', 'iOS');
    expect(
      form.queryByText('Direct download', { selector: '.ant-select-selection-item' }),
    ).toBeNull();
    await user.click(form.getByRole('combobox', { name: 'Distribution' }));
    const option = (
      await screen.findAllByText('Direct download', { selector: '.ant-select-item-option-content' })
    ).at(-1) as HTMLElement;
    expect(option.closest('.ant-select-item')?.className).toContain(
      'ant-select-item-option-disabled',
    );
    expect(form.getByText(enUS['channels.directHelp'])).toBeTruthy();
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('checks the package name has no spaces or slashes', async () => {
    const { calls, user } = await load();
    const form = await openNew(user);
    await fillNew(user, form, { pkg: 'com example/x' });
    await user.click(submit(form));
    expect(await form.findByText(enUS['channels.rule.packageName'])).toBeTruthy();
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('keeps the dialog and what was typed when the server refuses, and shows only the words of the error code', async () => {
    const { user } = await load();
    const form = await openNew(user);
    await fillNew(user, form);
    overrideFetch(async ({ method }) =>
      method === 'POST'
        ? jsonAnswer(403, 'ADMIN_FORBIDDEN', null, 'secret backend words')
        : undefined,
    );
    await user.click(submit(form));
    expect(await form.findByText(enUS['error.ADMIN_FORBIDDEN'])).toBeTruthy();
    expect(document.body.textContent).not.toContain('secret backend words');
    expect(form.getByRole('textbox', { name: 'Channel code' })).toHaveValue('partner-th');
  });

  it('opens empty again after an edit, and an edit shows its own values after a new one', async () => {
    const { user } = await load();
    let form = await openNew(user);
    await user.type(form.getByRole('textbox', { name: 'Channel code' }), 'typed');
    await user.click(form.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const row = await rowOf('direct');
    await user.click(within(row).getByRole('button', { name: 'Edit' }));
    form = within(await dialog());
    expect(form.getByRole('textbox', { name: 'Name' })).toHaveValue('Direct download');
    await user.click(form.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    form = await openNew(user);
    expect(form.getByRole('textbox', { name: 'Channel code' })).toHaveValue('');
    expect(form.getByRole('textbox', { name: 'Name' })).toHaveValue('');
  });
});

describe('editing a channel package', { timeout: 60000 }, () => {
  const openEdit = async (user: ReturnType<typeof userEvent.setup>, code: string) => {
    const row = await rowOf(code);
    await user.click(within(row).getByRole('button', { name: 'Edit' }));
    return within(await dialog());
  };

  it('changes only the name and the package name; the code, platform and distribution are text', async () => {
    const { user } = await load();
    const form = await openEdit(user, 'play');
    expect(form.getByText('Edit channel package play')).toBeTruthy();
    expect(form.getByTestId('channel-fixed').textContent).toContain('play');
    expect(form.getByTestId('channel-fixed').textContent).toContain('Android');
    expect(form.getByTestId('channel-fixed').textContent).toContain('Store');
    expect(form.getAllByRole('textbox').map((el) => (el as HTMLInputElement).id)).toHaveLength(2);
    expect(form.queryByRole('combobox')).toBeNull();
    expect(form.getByRole('textbox', { name: 'Name' })).toHaveValue('Android store');
    expect(form.getByRole('textbox', { name: 'Package name' })).toHaveValue('app.example.play');
  });

  it('saves the name and package name, keeping the enabled state', async () => {
    const { calls, user } = await load();
    const form = await openEdit(user, 'play');
    const name = form.getByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, 'Play สโตร์ 🌟');
    const pkg = form.getByRole('textbox', { name: 'Package name' });
    await user.clear(pkg);
    await user.click(submit(form));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0]).toMatchObject({ method: 'PUT', url: '/api/admin/channels/play' });
    expect(writesOf(calls)[0].body).toEqual({
      name: 'Play สโตร์ 🌟',
      packageName: null,
      enabled: true,
    });
    expect(channelsState.channels.get('play')).toMatchObject({
      name: 'Play สโตร์ 🌟',
      packageName: null,
    });
    await waitFor(() => expect(cellsOf(rows()[0])[1]).toBe('Play สโตร์ 🌟'));
  });

  it('keeps a channel that is switched off switched off when its name is changed', async () => {
    must(channelsState.channels.get('direct')).enabled = false;
    const { calls, user } = await load();
    const form = await openEdit(user, 'direct');
    const name = form.getByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, 'Direct, renamed');
    await user.click(submit(form));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0].body).toEqual({
      name: 'Direct, renamed',
      packageName: 'app.example.direct',
      enabled: false,
    });
    expect(channelsState.channels.get('direct')?.enabled).toBe(false);
  });

  it('sends one request when Submit is pressed twice in the same instant, before the dialog has shown that it is working', async () => {
    const { calls, user } = await load();
    const form = await openEdit(user, 'play');
    const button = submit(form);
    const hold = holdWrites();
    act(() => {
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.submit(document.querySelector('form') as HTMLFormElement);
    });
    await settled();
    expect(hold.started()).toBe(1);
    hold.release();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(writesOf(calls)).toHaveLength(1);
  });

  it('wants a name', async () => {
    const { calls, user } = await load();
    const form = await openEdit(user, 'play');
    await user.clear(form.getByRole('textbox', { name: 'Name' }));
    await user.click(submit(form));
    expect(await form.findByText(enUS['channels.rule.nameRequired'])).toBeTruthy();
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('sends one request when Submit is pressed twice', async () => {
    const { calls, user } = await load();
    const form = await openEdit(user, 'play');
    const hold = holdWrites();
    await user.click(submit(form));
    fireEvent.click(submit(form));
    await settled();
    expect(hold.started()).toBe(1);
    hold.release();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(writesOf(calls)).toHaveLength(1);
  });
});

describe('the enabled switch', { timeout: 60000 }, () => {
  it('switches a channel on without asking, with the name, the package and the new state', async () => {
    must(channelsState.channels.get('direct')).enabled = false;
    const { calls, user } = await load();
    const row = await rowOf('direct');
    await user.click(within(row).getByRole('switch'));
    await waitFor(() => expect(channelsState.channels.get('direct')?.enabled).toBe(true));
    expect(writesOf(calls)).toHaveLength(1);
    expect(writesOf(calls)[0]).toMatchObject({ method: 'PUT', url: '/api/admin/channels/direct' });
    expect(writesOf(calls)[0].body).toEqual({
      name: 'Direct download',
      packageName: 'app.example.direct',
      enabled: true,
    });
  });

  it('asks before it switches a channel off, and says what follows', async () => {
    const { calls, user } = await load();
    const row = await rowOf('play');
    await user.click(within(row).getByRole('switch'));
    const question = await screen.findByText(/Switch off Android store\?/);
    expect(question.textContent).toContain('no version can be created or activated');
    expect(writesOf(calls)).toHaveLength(0);
    expect(channelsState.channels.get('play')?.enabled).toBe(true);
    await user.click(await screen.findByRole('button', { name: 'Switch off' }));
    await waitFor(() => expect(channelsState.channels.get('play')?.enabled).toBe(false));
    expect(writesOf(calls)).toHaveLength(1);
    expect(writesOf(calls)[0].body).toMatchObject({ enabled: false });
  });

  it('breaks the name of a channel of 5000 letters without a space inside the question, not out of it', async () => {
    must(channelsState.channels.get('play')).name = 'N'.repeat(5000);
    const { user } = await load();
    await user.click(within(await rowOf('play')).getByRole('switch'));
    const question = (await screen.findByText(/Switch off N{5000}\?/)) as HTMLElement;
    expect(question.style.overflowWrap).toBe('anywhere');
    expect(question.style.maxWidth).not.toBe('');
  });

  it('keeps the table on the page while it is read again after a change (it does not empty and fill again)', async () => {
    must(channelsState.channels.get('direct')).enabled = false;
    const { calls, user } = await load();
    const rowBefore = await rowOf('direct');
    // From now on the read of the list is held, so that the page is in the middle of reading again.
    const real = globalThis.fetch;
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL, init: RequestInit = {}) => {
        const url = new URL(String(input), 'http://localhost');
        if ((init.method ?? 'GET') === 'GET' && url.pathname === '/api/admin/channels') {
          await gate;
        }
        return real(input, init);
      }),
    );
    await user.click(within(rowBefore).getByRole('switch'));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    await settled();
    expect(rowBefore.isConnected).toBe(true);
    expect(rows().some((tr) => tr.getAttribute('data-row-key') === 'direct')).toBe(true);
    release();
    await settled();
    expect(rows().some((tr) => tr.getAttribute('data-row-key') === 'direct')).toBe(true);
  });

  it('does nothing when the question is answered with Cancel', async () => {
    const { calls, user } = await load();
    const row = await rowOf('play');
    await user.click(within(row).getByRole('switch'));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    await settled();
    expect(writesOf(calls)).toHaveLength(0);
    expect(channelsState.channels.get('play')?.enabled).toBe(true);
  });

  it('sends one request when the answer is pressed twice', async () => {
    const { calls, user } = await load();
    const row = await rowOf('play');
    await user.click(within(row).getByRole('switch'));
    const ok = await screen.findByRole('button', { name: 'Switch off' });
    const hold = holdWrites();
    await user.click(ok);
    fireEvent.click(ok);
    await settled();
    expect(hold.started()).toBe(1);
    hold.release();
    await waitFor(() => expect(channelsState.channels.get('play')?.enabled).toBe(false));
    expect(writesOf(calls)).toHaveLength(1);
  });

  it('sends one request when the answer is pressed twice in the same instant', async () => {
    const { calls, user } = await load();
    const row = await rowOf('play');
    await user.click(within(row).getByRole('switch'));
    const ok = await screen.findByRole('button', { name: 'Switch off' });
    const hold = holdWrites();
    act(() => {
      fireEvent.click(ok);
      fireEvent.click(ok);
    });
    await settled();
    expect(hold.started()).toBe(1);
    hold.release();
    await waitFor(() => expect(channelsState.channels.get('play')?.enabled).toBe(false));
    expect(writesOf(calls)).toHaveLength(1);
  });

  it('sends one request when the switch is pressed twice to switch on', async () => {
    must(channelsState.channels.get('direct')).enabled = false;
    const { calls, user } = await load();
    const row = await rowOf('direct');
    const toggle = within(row).getByRole('switch');
    const hold = holdWrites();
    await user.click(toggle);
    fireEvent.click(toggle);
    await settled();
    expect(hold.started()).toBe(1);
    hold.release();
    await waitFor(() => expect(channelsState.channels.get('direct')?.enabled).toBe(true));
    expect(writesOf(calls)).toHaveLength(1);
  });

  it('shows the words of the error code when the server refuses, and the switch goes back to what the list says', async () => {
    const { user } = await load();
    const row = await rowOf('play');
    overrideFetch(async ({ method }) =>
      method === 'PUT'
        ? jsonAnswer(403, 'ADMIN_FORBIDDEN', null, 'secret backend words')
        : undefined,
    );
    await user.click(within(row).getByRole('switch'));
    await user.click(await screen.findByRole('button', { name: 'Switch off' }));
    expect(await screen.findByText(enUS['error.ADMIN_FORBIDDEN'])).toBeTruthy();
    expect(document.body.textContent).not.toContain('secret backend words');
    await waitFor(() =>
      expect(
        (rows()[0].querySelector('[role="switch"]') as HTMLElement).getAttribute('aria-checked'),
      ).toBe('true'),
    );
  });
});

describe('the Chinese page', () => {
  it('shows the headers, the note and the buttons in Chinese', async () => {
    backend();
    renderPage(<ChannelsPage />, 'zh-CN');
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    expect(document.querySelector('.ant-table-thead')?.textContent).toContain('渠道码');
    expect(screen.getByRole('button', { name: '新建渠道包' })).toBeTruthy();
    expect(document.body.textContent).toContain('没有删除');
    expect(document.body.textContent).not.toMatch(/channels\./);
  });
});
