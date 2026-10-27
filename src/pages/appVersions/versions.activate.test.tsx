import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import appVersionsMock from '../../../mock/appVersions.mock';
import channelsMock from '../../../mock/channels.mock';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import enUS from '../../locales/en-US';
import {
  appVersionsState,
  channelsState,
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
const openActivation = async (user: ReturnType<typeof userEvent.setup>, id: string) => {
  const row = await rowOf(id);
  await user.click(within(row).getByRole('button', { name: 'Activate' }));
  return screen.findByRole('dialog');
};
const LIVE = enUS['appVersions.activate.confirmLive'];
// A button that has been working keeps the name of its spinner (happy-dom never ends the animation).
const dialogSubmit = (dialog: HTMLElement) =>
  within(dialog).getByRole('button', { name: /^(loading )?Activate$/ }) as HTMLButtonElement;

describe('activating a version of a STORE channel', () => {
  it('says that it becomes the only active version and what the users will meet, and asks whether the store shows it', async () => {
    const { user } = await load();
    const draft = versionBy('play', 120);
    const dialog = await openActivation(user, draft.id);
    expect(within(dialog).getByText('Activate version 1.2.0')).toBeTruthy();
    expect(dialog.textContent).toContain('the only active version of the channel');
    expect(dialog.textContent).toContain('Android store');
    expect(dialog.textContent).toContain('a store page without it');
    expect(within(dialog).getByRole('checkbox', { name: LIVE })).toBeTruthy();
  });

  it('cannot be sent until the box is ticked; then it sends confirmStoreLive=true, once', async () => {
    const { calls, user } = await load();
    const draft = versionBy('play', 120);
    const before = versionBy('play', 110);
    const dialog = await openActivation(user, draft.id);
    expect(dialog).toBeTruthy();
    expect(dialogSubmit(dialog).disabled).toBe(true);
    fireEvent.click(dialogSubmit(dialog));
    await settled();
    expect(writesOf(calls)).toHaveLength(0);
    await user.click(within(dialog).getByRole('checkbox', { name: LIVE }));
    const ok = dialogSubmit(dialog);
    expect(ok.disabled).toBe(false);
    const hold = holdWrites();
    await user.click(ok);
    // (while it works the button also carries the name of its spinner, so it is held by reference)
    fireEvent.click(ok);
    await settled();
    expect(hold.started()).toBe(1);
    hold.release();
    await waitFor(() => expect(appVersionsState.versions.get(draft.id)?.status).toBe('ACTIVE'));
    expect(writesOf(calls).map((c) => [c.method, c.url, c.body])).toEqual([
      [
        'PUT',
        `/api/admin/app-versions/${draft.id}/status`,
        { status: 'ACTIVE', confirmStoreLive: true },
      ],
    ]);
    expect(appVersionsState.versions.get(before.id)?.status).toBe('ARCHIVED');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await screen.findByText('Version 1.2.0 is now active')).toBeTruthy();
  });

  it('sends one request when the button is pressed twice in the same instant, before the page has shown that it is working', async () => {
    const { calls, user } = await load();
    const draft = versionBy('play', 120);
    const dialog = await openActivation(user, draft.id);
    await user.click(within(dialog).getByRole('checkbox', { name: LIVE }));
    const ok = dialogSubmit(dialog);
    const hold = holdWrites();
    act(() => {
      fireEvent.click(ok);
      fireEvent.click(ok);
    });
    await settled();
    expect(hold.started()).toBe(1);
    hold.release();
    await waitFor(() => expect(appVersionsState.versions.get(draft.id)?.status).toBe('ACTIVE'));
    expect(writesOf(calls)).toHaveLength(1);
  });

  it('asks again at every activation: the box is empty each time the dialog opens', async () => {
    const { user } = await load();
    const play = versionBy('play', 120);
    let dialog = await openActivation(user, play.id);
    await user.click(within(dialog).getByRole('checkbox', { name: LIVE }));
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    dialog = await openActivation(user, versionBy('appstore', 311).id);
    const box = within(dialog).getByRole('checkbox', { name: LIVE }) as HTMLInputElement;
    expect(box.checked).toBe(false);
    expect(dialogSubmit(dialog).disabled).toBe(true);
  });

  it('uses the strong text when the minimum version number is higher than the version that is active', async () => {
    const { user } = await load();
    const draft = versionBy('appstore', 311);
    const active = versionBy('appstore', 310);
    expect(draft.minVersionCode).toBeGreaterThan(active.versionCode);
    const dialog = await openActivation(user, draft.id);
    const strong = await within(dialog).findByTestId('activate-strong');
    expect(strong.textContent).toContain(String(draft.minVersionCode));
    expect(strong.textContent).toContain(String(active.versionCode));
    expect(strong.textContent).toMatch(/forced to update/);
  });

  it('has no strong text when the minimum is not higher than the active version (equal is not higher)', async () => {
    const { user } = await load();
    const draft = versionBy('play', 120);
    const active = versionBy('play', 110);
    expect(draft.minVersionCode).toBe(active.versionCode);
    const dialog = await openActivation(user, draft.id);
    await within(dialog).findByRole('checkbox', { name: LIVE });
    await settled();
    expect(within(dialog).queryByTestId('activate-strong')).toBeNull();
    // what users below the minimum meet is still written
    expect(dialog.textContent).toContain(
      `lower than ${draft.minVersionCode} will be forced to update`,
    );
  });

  it('says so when the active version could not be read and the page has no active version of the channel to look at', async () => {
    const { user } = await load();
    // only drafts on the page: the list has nothing to fall back on
    await user.click(screen.getByRole('combobox', { name: 'Status' }));
    const options = await screen.findAllByText('Draft', {
      selector: '.ant-select-item-option-content',
    });
    await user.click(options[options.length - 1]);
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(rows().every((tr) => tr.textContent?.includes('Draft'))).toBe(true));
    overrideFetch(async ({ url, method }) =>
      method === 'GET' && url.searchParams.get('status') === 'ACTIVE'
        ? jsonAnswer(500, 'INTERNAL_ERROR')
        : undefined,
    );
    const draft = versionBy('appstore', 311);
    const dialog = await openActivation(user, draft.id);
    const strong = await within(dialog).findByTestId('activate-strong');
    expect(strong.textContent).toContain('could not be read');
    expect(strong.textContent).toContain(String(draft.minVersionCode));
  });

  it('falls back on the active version the page shows when the read of it failed', async () => {
    const { user } = await load();
    overrideFetch(async ({ url, method }) =>
      method === 'GET' && url.searchParams.get('status') === 'ACTIVE'
        ? jsonAnswer(500, 'INTERNAL_ERROR')
        : undefined,
    );
    const draft = versionBy('appstore', 311);
    const dialog = await openActivation(user, draft.id);
    const strong = await within(dialog).findByTestId('activate-strong');
    expect(strong.textContent).not.toContain('could not be read');
    expect(strong.textContent).toContain('310');
  });

  it('warns when the draft is not higher than the version that is active, and leaves the decision to the server', async () => {
    const draft = versionBy('play', 120);
    draft.versionCode = 110;
    draft.minVersionCode = 1;
    const { calls, user } = await load();
    const dialog = await openActivation(user, draft.id);
    const warning = await within(dialog).findByTestId('activate-not-above');
    expect(warning.textContent).toContain('110');
    await user.click(within(dialog).getByRole('checkbox', { name: LIVE }));
    await user.click(dialogSubmit(dialog));
    // the server refuses; the page shows the words of the error code and keeps the dialog
    expect(await within(dialog).findByText(enUS['error.INVALID_REQUEST'])).toBeTruthy();
    expect(writesOf(calls)).toHaveLength(1);
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('shows only the words of the error code when the server refuses, never its own message', async () => {
    const { user } = await load();
    const draft = versionBy('play', 120);
    const dialog = await openActivation(user, draft.id);
    await user.click(within(dialog).getByRole('checkbox', { name: LIVE }));
    overrideFetch(async ({ method, url }) =>
      method === 'PUT' && url.pathname.endsWith('/status')
        ? jsonAnswer(409, 'INVALID_STATE', { status: 'ACTIVE' }, 'backend words about state')
        : undefined,
    );
    await user.click(dialogSubmit(dialog));
    expect(await within(dialog).findByText(enUS['error.INVALID_STATE'])).toBeTruthy();
    expect(dialog.textContent).not.toContain('backend words about state');
    // it can be sent again after the fault is gone
    await waitFor(() => expect(dialogSubmit(dialog).disabled).toBe(false));
  });

  it('lists the reasons the server gives for fields, in words', async () => {
    const { user } = await load();
    const draft = versionBy('play', 120);
    const dialog = await openActivation(user, draft.id);
    await user.click(within(dialog).getByRole('checkbox', { name: LIVE }));
    overrideFetch(async ({ method, url }) =>
      method === 'PUT' && url.pathname.endsWith('/status')
        ? jsonAnswer(400, 'INVALID_REQUEST', {
            details: [{ ref: 'versionCode', reason: 'OUT_OF_RANGE' }],
          })
        : undefined,
    );
    await user.click(dialogSubmit(dialog));
    expect(await within(dialog).findByText(enUS['reason.OUT_OF_RANGE'])).toBeTruthy();
  });

  it('does not offer the dialog without APPVERSION:ACTIVATE', async () => {
    signIn('support', { codes: ['APPVERSION:VIEW', 'APPVERSION:MANAGE'] });
    await load();
    const row = await rowOf(versionBy('play', 120).id);
    expect(within(row).queryByRole('button', { name: 'Activate' })).toBeNull();
  });
});

describe('activating a version of a DIRECT channel', () => {
  it('does not ask whether the store shows it; says that users will be prompted to download the APK; sends no confirmStoreLive', async () => {
    const { calls, user } = await load();
    const draft = versionBy('direct', 120);
    const dialog = await openActivation(user, draft.id);
    expect(within(dialog).queryByRole('checkbox')).toBeNull();
    expect(dialog.textContent).toContain('will be prompted to download this APK');
    expect(dialog.textContent).not.toContain('store page without it');
    expect(dialogSubmit(dialog).disabled).toBe(false);
    await user.click(dialogSubmit(dialog));
    await waitFor(() => expect(appVersionsState.versions.get(draft.id)?.status).toBe('ACTIVE'));
    expect(writesOf(calls).map((c) => c.body)).toEqual([{ status: 'ACTIVE' }]);
  });

  it('knows the kind of the channel from the version itself when the channel list cannot be read', async () => {
    backend();
    overrideFetch(async ({ url, method }) =>
      method === 'GET' && url.pathname === '/api/admin/channels'
        ? jsonAnswer(500, 'INTERNAL_ERROR')
        : undefined,
    );
    const user = userEvent.setup();
    renderPage(<AppVersionsPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    const direct = await openActivation(user, versionBy('direct', 120).id);
    expect(within(direct).queryByRole('checkbox')).toBeNull();
    await user.click(within(direct).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const store = await openActivation(user, versionBy('play', 120).id);
    expect(within(store).getByRole('checkbox', { name: LIVE })).toBeTruthy();
  });

  it('shows the channel as its code when the channel list has no name for it', async () => {
    channelsState.channels.delete('direct');
    const { user } = await load();
    const dialog = await openActivation(user, versionBy('direct', 120).id);
    expect(dialog.textContent).toContain('direct');
  });
});

describe('what the dialog does not remember', () => {
  it('does not keep the failure of one activation for the next dialog', async () => {
    const { user } = await load();
    const taken = overrideFetch(async ({ method, url }) =>
      method === 'PUT' && url.pathname.endsWith('/status')
        ? jsonAnswer(409, 'INVALID_STATE', { status: 'ACTIVE' })
        : undefined,
    );
    let dialog = await openActivation(user, versionBy('play', 120).id);
    await user.click(within(dialog).getByRole('checkbox', { name: LIVE }));
    await user.click(dialogSubmit(dialog));
    await within(dialog).findByText(enUS['error.INVALID_STATE']);
    expect(taken).toHaveLength(1);
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    dialog = await openActivation(user, versionBy('appstore', 311).id);
    expect(within(dialog).queryByText(enUS['error.INVALID_STATE'])).toBeNull();
  });

  it('shows the active version of the channel of this dialog, not of the one opened before (old answers are dropped)', async () => {
    const { user } = await load();
    let releaseFirst: () => void = () => {};
    const first = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let reads = 0;
    const real = globalThis.fetch;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL, init: RequestInit = {}) => {
        const url = new URL(String(input), 'http://localhost');
        if (
          url.pathname === '/api/admin/app-versions' &&
          url.searchParams.get('status') === 'ACTIVE'
        ) {
          reads += 1;
          if (reads === 1) await first;
        }
        return real(input, init);
      }),
    );
    let dialog = await openActivation(user, versionBy('play', 120).id);
    await waitFor(() => expect(reads).toBe(1));
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    dialog = await openActivation(user, versionBy('appstore', 311).id);
    const strong = await within(dialog).findByTestId('activate-strong');
    releaseFirst();
    await settled();
    expect(within(dialog).getByTestId('activate-strong').textContent).toBe(strong.textContent);
    expect(strong.textContent).toContain('310');
  });
});
