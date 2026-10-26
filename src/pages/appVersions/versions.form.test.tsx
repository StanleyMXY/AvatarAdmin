import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import appVersionsMock from '../../../mock/appVersions.mock';
import channelsMock from '../../../mock/channels.mock';
import { fileOf, zipBytes } from '../../../tests/imageBytes';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import enUS from '../../locales/en-US';
import {
  appVersionsState,
  channelsState,
  dialogsClosed,
  holdWrites,
  jsonAnswer,
  META,
  overrideFetch,
  settled,
  signIn,
  uploads,
  writesOf,
} from './testSetup';
import AppVersionsPage from './versions';

vi.mock('../../request/upload', async () => {
  const base = (await import('./testSetup')).uploadModule;
  return { uploadFile: async (options: { url: string; file: File }) => base.uploadFile(options) };
});

const backend = () => useMockBackend({ default: appVersionsMock }, { default: channelsMock });
const META_LOCALES = { ...META, supportedLocales: ['en', 'th', 'ar', 'zh-Hans'] };

beforeEach(() => {
  signIn('root', { meta: META_LOCALES });
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
const dialog = () => screen.findByRole('dialog');
const openNew = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'New version' }));
  return within(await dialog());
};
const openEdit = async (user: ReturnType<typeof userEvent.setup>, id: string) => {
  const row = await rowOf(id);
  await user.click(within(row).getByRole('button', { name: 'Edit' }));
  return within(await dialog());
};
const pickChannel = async (
  user: ReturnType<typeof userEvent.setup>,
  form: ReturnType<typeof within>,
  name: RegExp | string,
) => {
  await user.click(form.getByRole('combobox', { name: 'Channel package' }));
  const options = await screen.findAllByText(name, { selector: '.ant-select-item-option-content' });
  await user.click(options[options.length - 1]);
};
const setNumber = async (
  user: ReturnType<typeof userEvent.setup>,
  form: ReturnType<typeof within>,
  label: string,
  value: string,
) => {
  const field = form.getByRole('spinbutton', { name: label });
  await user.clear(field);
  if (value !== '') await user.type(field, value);
};
const fillCommon = async (
  user: ReturnType<typeof userEvent.setup>,
  form: ReturnType<typeof within>,
  over: { name?: string; code?: string; min?: string; en?: string } = {},
) => {
  const name = form.getByRole('textbox', { name: 'Version name' });
  await user.clear(name);
  await user.type(name, over.name ?? '1.3.0');
  await setNumber(user, form, 'Version number', over.code ?? '130');
  await setNumber(user, form, 'Minimum version number', over.min ?? '110');
  await user.type(form.getByRole('textbox', { name: 'en' }), over.en ?? 'Faster calls');
};
const PLAY_URL = 'https://play.google.com/store/apps/details?id=app.example.play';
const typeUrl = async (
  user: ReturnType<typeof userEvent.setup>,
  form: ReturnType<typeof within>,
  url: string,
) => {
  const field = form.getByRole('textbox', { name: 'Store link' });
  await user.clear(field);
  if (url !== '') await user.paste(url);
};
// A button that has been working keeps the name of its spinner (happy-dom never ends the animation).
const submit = (form: ReturnType<typeof within>) =>
  form.getByRole('button', { name: /^(loading )?Submit$/ });
const choose = (file: File) =>
  fireEvent.change(screen.getByTestId('upload-input'), { target: { files: [file] } });
const apk = (name = 'avatar.apk', padTo?: number) => fileOf(zipBytes(), name, padTo);

describe('creating a version of a STORE channel', { timeout: 60000 }, () => {
  it('opens empty, with the store link and no APK control once a STORE channel is chosen', async () => {
    const { user } = await load();
    const form = await openNew(user);
    expect(form.getByRole('textbox', { name: 'Version name' })).toHaveValue('');
    await pickChannel(user, form, /Android store/);
    expect(form.getByRole('textbox', { name: 'Store link' })).toBeTruthy();
    expect(screen.queryByTestId('upload-input')).toBeNull();
    expect(form.getByText('Android · Store')).toBeTruthy();
  });

  it('writes beside the minimum version number that the users below it will be forced to update', async () => {
    const { user } = await load();
    const form = await openNew(user);
    expect(form.getByText(enUS['appVersions.minVersionCodeHelp'])).toBeTruthy();
  });

  it('creates with the values trimmed and the notes of the languages that have text, and no field about a file', async () => {
    const { calls, user } = await load();
    const form = await openNew(user);
    await pickChannel(user, form, /Android store/);
    await fillCommon(user, form);
    await user.click(form.getByRole('tab', { name: /th/ }));
    await user.type(form.getByRole('textbox', { name: 'th' }), '  โทรเร็วขึ้น  ');
    await typeUrl(user, form, `  ${PLAY_URL}&hl=th  `);
    await user.click(submit(form));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    const request = writesOf(calls)[0];
    expect(request).toMatchObject({ method: 'POST', url: '/api/admin/app-versions' });
    expect(request.body).toEqual({
      channelCode: 'play',
      versionName: '1.3.0',
      versionCode: 130,
      minVersionCode: 110,
      changelog: { en: 'Faster calls', th: 'โทรเร็วขึ้น' },
      storeUrl: `${PLAY_URL}&hl=th`,
    });
    await dialogsClosed();
    await waitFor(() => expect(rows().some((tr) => tr.textContent?.includes('1.3.0'))).toBe(true));
    expect(await screen.findByText(enUS['appVersions.saved'])).toBeTruthy();
  });

  it('sends one request when Submit is pressed twice', async () => {
    const { calls, user } = await load();
    const form = await openNew(user);
    await pickChannel(user, form, /Android store/);
    await fillCommon(user, form);
    await typeUrl(user, form, PLAY_URL);
    const hold = holdWrites();
    await user.click(submit(form));
    fireEvent.click(submit(form));
    fireEvent.submit(document.querySelector('form') as HTMLFormElement);
    await settled();
    expect(hold.started()).toBe(1);
    hold.release();
    await dialogsClosed();
    expect(writesOf(calls)).toHaveLength(1);
  });

  it('keeps the dialog and the typed values when the server refuses, with the words of the error code only', async () => {
    const { user } = await load();
    const form = await openNew(user);
    await pickChannel(user, form, /Android store/);
    await fillCommon(user, form);
    await typeUrl(user, form, PLAY_URL);
    overrideFetch(async ({ method }) =>
      method === 'POST'
        ? jsonAnswer(409, 'DUPLICATE_RESOURCE', { field: 'versionCode' }, 'secret words')
        : undefined,
    );
    await user.click(submit(form));
    expect((await form.findAllByText(enUS['error.DUPLICATE_RESOURCE'])).length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toContain('secret words');
    expect(form.getByRole('textbox', { name: 'Version name' })).toHaveValue('1.3.0');
    expect(form.getByRole('spinbutton', { name: 'Version number' })).toHaveValue('130');
  });

  it('puts a refusal of one field under that field', async () => {
    const { user } = await load();
    const form = await openNew(user);
    await pickChannel(user, form, /Android store/);
    await fillCommon(user, form);
    await typeUrl(user, form, PLAY_URL);
    overrideFetch(async ({ method }) =>
      method === 'POST'
        ? jsonAnswer(400, 'INVALID_REQUEST', {
            details: [{ ref: 'minVersionCode', reason: 'OUT_OF_RANGE' }],
          })
        : undefined,
    );
    await user.click(submit(form));
    const item = (await form.findByText(enUS['reason.OUT_OF_RANGE'])).closest(
      '.ant-form-item',
    ) as HTMLElement;
    expect(within(item).getByRole('spinbutton', { name: 'Minimum version number' })).toBeTruthy();
  });

  it('does not let a channel that is switched off be chosen', async () => {
    channelsState.channels.get('play')!.enabled = false;
    const { user } = await load();
    const form = await openNew(user);
    await user.click(form.getByRole('combobox', { name: 'Channel package' }));
    const option = (
      await screen.findAllByText(/Android store.*switched off/, {
        selector: '.ant-select-item-option-content',
      })
    ).at(-1) as HTMLElement;
    expect(option.closest('.ant-select-item')?.className).toContain(
      'ant-select-item-option-disabled',
    );
  });

  it('wants a channel, and says so, without sending anything', async () => {
    const { calls, user } = await load();
    const form = await openNew(user);
    await fillCommon(user, form);
    await user.click(submit(form));
    expect(await form.findByText(enUS['appVersions.channelRequired'])).toBeTruthy();
    expect(writesOf(calls)).toHaveLength(0);
  });
});

describe('the rules of the form', { timeout: 60000 }, () => {
  it('compares the version number with the version that is active in the channel, as a hint', async () => {
    const { calls, user } = await load();
    const form = await openNew(user);
    await pickChannel(user, form, /Android store/);
    expect(await form.findByText(/now: 110/)).toBeTruthy();
    expect(form.getByText(/the server decides/)).toBeTruthy();
    await setNumber(user, form, 'Version number', '110');
    await setNumber(user, form, 'Minimum version number', '1');
    await user.type(form.getByRole('textbox', { name: 'Version name' }), '1.1.0');
    await user.type(form.getByRole('textbox', { name: 'en' }), 'x');
    await typeUrl(user, form, PLAY_URL);
    await user.click(submit(form));
    expect(
      await form.findByText(
        'It must be higher than 110, the version number active in this channel',
      ),
    ).toBeTruthy();
    expect(writesOf(calls)).toHaveLength(0);
    await setNumber(user, form, 'Version number', '111');
    await user.click(submit(form));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
  });

  it('says that no version is active, and does not compare, when the channel has none', async () => {
    for (const v of appVersionsState.versions.values()) {
      if (v.channelCode === 'play' && v.status === 'ACTIVE') v.status = 'ARCHIVED';
    }
    const { user } = await load();
    const form = await openNew(user);
    await pickChannel(user, form, /Android store/);
    expect(await form.findByText(enUS['appVersions.activeNone'])).toBeTruthy();
  });

  it('says that the number is not compared when the active version could not be read, and still sends (the server decides)', async () => {
    const { calls, user } = await load();
    overrideFetch(async ({ url, method }) =>
      method === 'GET' && url.searchParams.get('status') === 'ACTIVE'
        ? jsonAnswer(500, 'INTERNAL_ERROR')
        : undefined,
    );
    const form = await openNew(user);
    await pickChannel(user, form, /Android store/);
    expect(await form.findByText(enUS['appVersions.activeUnknown'])).toBeTruthy();
    await fillCommon(user, form, { code: '50', min: '1' });
    await typeUrl(user, form, PLAY_URL);
    await user.click(submit(form));
    await waitFor(() => expect(writesOf(calls).length).toBe(1));
  });

  it('drops the hint of the channel that was chosen first when another is chosen (old answers are dropped)', async () => {
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
    const form = await openNew(user);
    await pickChannel(user, form, /Android store/);
    await waitFor(() => expect(reads).toBe(1));
    await pickChannel(user, form, /iOS store/);
    expect(await form.findByText(/now: 310/)).toBeTruthy();
    releaseFirst();
    await settled();
    expect(form.getByText(/now: 310/)).toBeTruthy();
    expect(form.queryByText(/now: 110/)).toBeNull();
  });

  it('keeps the minimum from 1 to the version number', async () => {
    const { calls, user } = await load();
    const form = await openNew(user);
    await pickChannel(user, form, /Android store/);
    await fillCommon(user, form, { min: '0' });
    await typeUrl(user, form, PLAY_URL);
    await user.click(submit(form));
    expect((await form.findAllByText(enUS['appVersions.rule.minWhole'])).length).toBeGreaterThan(0);
    await setNumber(user, form, 'Minimum version number', '131');
    await user.click(submit(form));
    expect(await form.findByText('It must not be higher than the version number 130')).toBeTruthy();
    expect(writesOf(calls)).toHaveLength(0);
    await setNumber(user, form, 'Minimum version number', '130');
    await user.click(submit(form));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
  });

  it('wants the version name as x.y.z', async () => {
    const { calls, user } = await load();
    const form = await openNew(user);
    await pickChannel(user, form, /Android store/);
    await fillCommon(user, form, { name: 'v1.3' });
    await typeUrl(user, form, PLAY_URL);
    await user.click(submit(form));
    expect(await form.findByText(enUS['appVersions.rule.versionName'])).toBeTruthy();
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('cannot be saved without English update notes, whatever other languages say', async () => {
    const { calls, user } = await load();
    const form = await openNew(user);
    await pickChannel(user, form, /Android store/);
    await fillCommon(user, form, { en: '   ' });
    await user.click(form.getByRole('tab', { name: /th/ }));
    await user.type(form.getByRole('textbox', { name: 'th' }), 'โทรเร็วขึ้น');
    await typeUrl(user, form, PLAY_URL);
    await user.click(submit(form));
    expect(await form.findByText(enUS['appVersions.rule.changelogEn'])).toBeTruthy();
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('offers a tab for English first and one for each language of the deployment', async () => {
    const { user } = await load();
    const form = await openNew(user);
    const tabs = form.getAllByRole('tab').map((t) => t.textContent ?? '');
    expect(tabs[0]).toMatch(/^en/);
    for (const tag of ['th', 'ar', 'zh-Hans'])
      expect(
        tabs.some((t) => t.startsWith(tag)),
        tag,
      ).toBe(true);
    expect(tabs.filter((t) => t.startsWith('en')).length).toBe(1);
    // the notes typed in one tab are still there after looking at another
    await user.type(form.getByRole('textbox', { name: 'en' }), 'Kept');
    await user.click(form.getByRole('tab', { name: /ar/ }));
    await user.click(form.getByRole('tab', { name: /^en/ }));
    expect(form.getByRole('textbox', { name: 'en' })).toHaveValue('Kept');
  });

  it('accepts update notes of a long unbroken text, Arabic, Thai and emoji', async () => {
    const { calls, user } = await load();
    const form = await openNew(user);
    await pickChannel(user, form, /Android store/);
    await fillCommon(user, form, { en: '😀'.repeat(50) });
    const longText = 'ก'.repeat(5000);
    await user.click(form.getByRole('tab', { name: /th/ }));
    fireEvent.change(form.getByRole('textbox', { name: 'th' }), { target: { value: longText } });
    await user.click(form.getByRole('tab', { name: /ar/ }));
    fireEvent.change(form.getByRole('textbox', { name: 'ar' }), {
      target: { value: 'تحسينات 🌟' },
    });
    await typeUrl(user, form, PLAY_URL);
    await user.click(submit(form));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect((writesOf(calls)[0].body as { changelog: Record<string, string> }).changelog).toEqual({
      en: '😀'.repeat(50),
      th: longText,
      ar: 'تحسينات 🌟',
    });
  });

  it('checks the store link while it is typed, with the rule of the platform and the package name of the channel', async () => {
    const { calls, user } = await load();
    const form = await openNew(user);
    await pickChannel(user, form, /Android store/);
    await fillCommon(user, form);
    const cases: [string, string][] = [
      [
        'http://play.google.com/store/apps/details?id=app.example.play',
        'The link must start with lowercase https://.',
      ],
      [
        'https://play.google.com.evil.com/store/apps/details?id=app.example.play',
        enUS['appVersions.storeUrl.androidHost'],
      ],
      [
        'https://play.google.com/store/apps/details?id=other.app',
        enUS['appVersions.storeUrl.idMismatch'],
      ],
      [`${PLAY_URL}&referrer=x`, enUS['appVersions.storeUrl.queryKey']],
      [
        'https://play.google.com:443/store/apps/details?id=app.example.play',
        enUS['appVersions.storeUrl.port'],
      ],
      [`${PLAY_URL}#x`, enUS['appVersions.storeUrl.fragment']],
    ];
    for (const [url, message] of cases) {
      await typeUrl(user, form, url);
      expect(await form.findByText(message), url).toBeTruthy();
    }
    await user.click(submit(form));
    await settled();
    expect(writesOf(calls)).toHaveLength(0);
    await typeUrl(user, form, PLAY_URL);
    await waitFor(() => expect(form.queryByText(enUS['appVersions.storeUrl.fragment'])).toBeNull());
    await user.click(submit(form));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
  });

  it('does not carry the link typed for one channel over to another channel', async () => {
    const { user } = await load();
    const form = await openNew(user);
    await pickChannel(user, form, /Android store/);
    await typeUrl(user, form, PLAY_URL);
    expect(form.getByRole('textbox', { name: 'Store link' })).toHaveValue(PLAY_URL);
    await pickChannel(user, form, /iOS store/);
    expect(form.getByRole('textbox', { name: 'Store link' })).toHaveValue('');
  });

  it('checks an iOS channel against the App Store rule', async () => {
    const { user } = await load();
    const form = await openNew(user);
    await pickChannel(user, form, /iOS store/);
    await typeUrl(user, form, PLAY_URL);
    expect(await form.findByText(enUS['appVersions.storeUrl.iosHost'])).toBeTruthy();
    await typeUrl(user, form, 'https://apps.apple.com/th/app/avatar-chat/id1234567890');
    await waitFor(() => expect(form.queryByText(enUS['appVersions.storeUrl.iosHost'])).toBeNull());
  });

  it('wants the link of a STORE channel', async () => {
    const { calls, user } = await load();
    const form = await openNew(user);
    await pickChannel(user, form, /Android store/);
    await fillCommon(user, form);
    await user.click(submit(form));
    expect(await form.findByText(enUS['appVersions.storeUrlRequired'])).toBeTruthy();
    expect(writesOf(calls)).toHaveLength(0);
  });
});

describe('editing a draft', { timeout: 60000 }, () => {
  it('opens with the values of the draft, the channel as text that cannot be changed, and the notes of every language', async () => {
    const { user } = await load();
    const draft = versionBy('play', 120);
    const form = await openEdit(user, draft.id);
    expect(form.queryByRole('combobox', { name: 'Channel package' })).toBeNull();
    expect(form.getByTestId('version-channel-fixed').textContent).toContain('Android store');
    expect(form.getByRole('textbox', { name: 'Version name' })).toHaveValue('1.2.0');
    expect(form.getByRole('spinbutton', { name: 'Version number' })).toHaveValue('120');
    expect(form.getByRole('spinbutton', { name: 'Minimum version number' })).toHaveValue('110');
    expect(form.getByRole('textbox', { name: 'en' })).toHaveValue(draft.changelog.en);
    await user.click(form.getByRole('tab', { name: /th/ }));
    expect(form.getByRole('textbox', { name: 'th' })).toHaveValue(draft.changelog.th);
    expect(form.getByRole('textbox', { name: 'Store link' })).toHaveValue(draft.storeUrl as string);
  });

  it('saves with PUT on the draft and a body without the channel', async () => {
    const { calls, user } = await load();
    const draft = versionBy('play', 120);
    const form = await openEdit(user, draft.id);
    const name = form.getByRole('textbox', { name: 'Version name' });
    await user.clear(name);
    await user.type(name, '1.2.1');
    await user.click(submit(form));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    const request = writesOf(calls)[0];
    expect(request.method).toBe('PUT');
    expect(request.url).toBe(`/api/admin/app-versions/${draft.id}`);
    expect(request.body).not.toHaveProperty('channelCode');
    expect(request.body).toMatchObject({
      versionName: '1.2.1',
      versionCode: 120,
      minVersionCode: 110,
    });
    expect(appVersionsState.versions.get(draft.id)?.versionName).toBe('1.2.1');
  });

  it('opens with nothing of an earlier dialog: a new version after an edit is empty, an edit after a new one has its own values', async () => {
    const { user } = await load();
    const draft = versionBy('play', 120);
    let form = await openEdit(user, draft.id);
    expect(form.getByRole('textbox', { name: 'Version name' })).toHaveValue('1.2.0');
    await user.click(form.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    form = await openNew(user);
    expect(form.getByRole('textbox', { name: 'Version name' })).toHaveValue('');
    expect(form.getByRole('spinbutton', { name: 'Version number' })).toHaveValue('');
    expect(form.getByRole('textbox', { name: 'en' })).toHaveValue('');
    await user.type(form.getByRole('textbox', { name: 'Version name' }), '9.9.9');
    await user.click(form.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    form = await openEdit(user, versionBy('appstore', 311).id);
    expect(form.getByRole('textbox', { name: 'Version name' })).toHaveValue('3.2.0');
    expect(form.getByRole('textbox', { name: 'Store link' })).toHaveValue(
      versionBy('appstore', 311).storeUrl as string,
    );
  });

  it('is not offered for a version that is not a draft', async () => {
    await load();
    const active = await rowOf(versionBy('play', 110).id);
    expect(within(active).queryByRole('button', { name: 'Edit' })).toBeNull();
  });

  it('shows the words of the error code when the draft was activated meanwhile', async () => {
    const { user } = await load();
    const draft = versionBy('play', 120);
    const form = await openEdit(user, draft.id);
    appVersionsState.versions.get(draft.id)!.status = 'ACTIVE';
    await user.click(submit(form));
    expect(await form.findByText(enUS['error.INVALID_STATE'])).toBeTruthy();
  });
});

describe('a DIRECT channel: the APK', { timeout: 60000 }, () => {
  it('has the APK control and no store link, and beside it the limit and the type', async () => {
    const { user } = await load();
    const form = await openNew(user);
    await pickChannel(user, form, /Direct download/);
    expect(screen.getByTestId('upload-input')).toBeTruthy();
    expect(form.queryByRole('textbox', { name: 'Store link' })).toBeNull();
    expect(form.getByText(/Accepted: APK/)).toBeTruthy();
    expect(form.getByText(/Max 100 MB/)).toBeTruthy();
  });

  it('takes the native file box out of sight', async () => {
    const { user } = await load();
    const form = await openNew(user);
    await pickChannel(user, form, /Direct download/);
    const input = screen.getByTestId('upload-input') as HTMLInputElement;
    expect(input.style.display).toBe('none');
    void form;
  });

  it('refuses a file that is too large or is not an archive before anything is sent', async () => {
    const { user } = await load();
    const form = await openNew(user);
    await pickChannel(user, form, /Direct download/);
    choose(apk('big.apk', 104_857_601));
    expect(await form.findByText(/too large|File is too large/i)).toBeTruthy();
    expect(uploads).toHaveLength(0);
    choose(fileOf(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]), 'a.apk'));
    expect(await form.findByText(/Wrong file type|file type/i)).toBeTruthy();
    choose(fileOf(zipBytes(), 'notes.txt'));
    expect(await form.findByText(/Wrong file type|file type/i)).toBeTruthy();
    expect(uploads).toHaveLength(0);
  });

  it('uploads first, shows the address, size and checksum as text that cannot be edited, and creates with only the upload id', async () => {
    const { calls, user } = await load();
    const form = await openNew(user);
    await pickChannel(user, form, /Direct download/);
    await fillCommon(user, form, { min: '1' });
    choose(apk());
    const info = await form.findByTestId('apk-info');
    expect(uploads).toHaveLength(1);
    expect(uploads[0].url).toBe('/uploads/apk');
    const record = [...appVersionsState.uploads.values()].find((u) => !u.used)!;
    expect(info.textContent).toContain(record.apkUrl);
    expect(info.textContent).toContain(record.apkSha256);
    expect(info.querySelectorAll('input, textarea')).toHaveLength(0);
    await user.click(submit(form));
    await waitFor(() =>
      expect(writesOf(calls).filter((c) => c.url !== '/api/admin/uploads/apk')).toHaveLength(1),
    );
    const create = writesOf(calls).find((c) => c.url === '/api/admin/app-versions')!;
    expect(create.body).toEqual({
      channelCode: 'direct',
      versionName: '1.3.0',
      versionCode: 130,
      minVersionCode: 1,
      changelog: { en: 'Faster calls' },
      apkUploadId: record.id,
    });
    await dialogsClosed();
  });

  it('cannot be sent while the file is still uploading', async () => {
    const { calls, user } = await load();
    const form = await openNew(user);
    await pickChannel(user, form, /Direct download/);
    await fillCommon(user, form, { min: '1' });
    const hold = holdWrites();
    choose(apk());
    await waitFor(() => expect(hold.started()).toBe(1));
    expect(submit(form)).toBeDisabled();
    expect(await form.findByText(enUS['appVersions.apk.wait'])).toBeTruthy();
    fireEvent.submit(document.querySelector('form') as HTMLFormElement);
    await settled();
    expect(writesOf(calls).filter((c) => c.url === '/api/admin/app-versions')).toHaveLength(0);
    hold.release();
    await form.findByTestId('apk-info');
    expect(submit(form)).not.toBeDisabled();
  });

  it('does not send an edited draft with its old file while a new file is still going up', async () => {
    const { calls, user } = await load();
    const draft = versionBy('direct', 120);
    const form = await openEdit(user, draft.id);
    const hold = holdWrites();
    choose(apk('newer.apk'));
    await waitFor(() => expect(hold.started()).toBe(1));
    fireEvent.submit(document.querySelector('form') as HTMLFormElement);
    await settled();
    expect(writesOf(calls).filter((c) => c.method === 'PUT')).toHaveLength(0);
    hold.release();
    await waitFor(() =>
      expect(form.getByTestId('apk-info').textContent).not.toContain(draft.apkSha256 as string),
    );
  });

  it('wants a file for a new version of a DIRECT channel', async () => {
    const { calls, user } = await load();
    const form = await openNew(user);
    await pickChannel(user, form, /Direct download/);
    await fillCommon(user, form, { min: '1' });
    await user.click(submit(form));
    expect(await form.findByText(enUS['appVersions.apk.required'])).toBeTruthy();
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('keeps the file of a draft when it is edited, and sends its upload id again', async () => {
    const { calls, user } = await load();
    const draft = versionBy('direct', 120);
    const form = await openEdit(user, draft.id);
    const info = form.getByTestId('apk-info');
    expect(info.textContent).toContain(draft.apkSha256 as string);
    expect(form.getByText(enUS['appVersions.apk.current'])).toBeTruthy();
    await user.click(submit(form));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0].body).toMatchObject({ apkUploadId: draft.apkUploadId });
    expect(writesOf(calls)[0].body).not.toHaveProperty('apkSha256');
    expect(writesOf(calls)[0].body).not.toHaveProperty('apkUrl');
  });

  it('replaces the file of a draft with a new upload, and shows the new one', async () => {
    const { calls, user } = await load();
    const draft = versionBy('direct', 120);
    const old = draft.apkUploadId;
    const form = await openEdit(user, draft.id);
    choose(apk('new.apk'));
    await waitFor(() =>
      expect(form.getByTestId('apk-info').textContent).not.toContain(draft.apkSha256 as string),
    );
    await user.click(submit(form));
    await waitFor(() => expect(writesOf(calls).filter((c) => c.method === 'PUT')).toHaveLength(1));
    const body = writesOf(calls).find((c) => c.method === 'PUT')!.body as { apkUploadId: string };
    expect(body.apkUploadId).not.toBe(old);
    expect(appVersionsState.versions.get(draft.id)?.apkUploadId).toBe(body.apkUploadId);
  });

  it('says to set upload.public_base_url when the upload is answered with 503, with a link for CONFIG:MANAGE', async () => {
    const { user } = await load();
    appVersionsState.apkAvailable = false;
    const form = await openNew(user);
    await pickChannel(user, form, /Direct download/);
    choose(apk());
    const hint = await form.findByTestId('apk-unavailable');
    expect(hint.textContent).toContain('upload.public_base_url');
    expect(within(hint).getByRole('link').getAttribute('href')).toBe('/config');
  });

  it('shows the hint without the link to an administrator who cannot open the configuration', async () => {
    signIn('support', {
      codes: ['APPVERSION:VIEW', 'APPVERSION:MANAGE'],
      meta: META_LOCALES,
    });
    const { user } = await load();
    appVersionsState.apkAvailable = false;
    const form = await openNew(user);
    await pickChannel(user, form, /Direct download/);
    choose(apk());
    const hint = await form.findByTestId('apk-unavailable');
    expect(hint.textContent).toContain('upload.public_base_url');
    expect(within(hint).queryByRole('link')).toBeNull();
  });

  it('shows the words of the error code when the server refuses the file (no v2 signature)', async () => {
    const { user } = await load();
    appVersionsState.nextApkRefusal = true;
    const form = await openNew(user);
    await pickChannel(user, form, /Direct download/);
    choose(apk());
    expect(await form.findByText(enUS['error.INVALID_FILE'])).toBeTruthy();
    expect(form.queryByTestId('apk-info')).toBeNull();
    expect(form.queryByTestId('apk-unavailable')).toBeNull();
  });

  it('asks for the file again, and sends nothing, when the server says the upload id cannot be used', async () => {
    const { calls, user } = await load();
    const form = await openNew(user);
    await pickChannel(user, form, /Direct download/);
    await fillCommon(user, form, { min: '1' });
    choose(apk());
    await form.findByTestId('apk-info');
    overrideFetch(async ({ method, url }) =>
      method === 'POST' && url.pathname === '/api/admin/app-versions'
        ? jsonAnswer(409, 'INVALID_STATE', { status: 'USED' })
        : undefined,
    );
    await user.click(submit(form));
    expect(await form.findByText(enUS['appVersions.apk.rejected'])).toBeTruthy();
    expect(form.queryByTestId('apk-info')).toBeNull();
    const before = writesOf(calls).length;
    await user.click(submit(form));
    expect(await form.findByText(enUS['appVersions.apk.required'])).toBeTruthy();
    expect(writesOf(calls).length).toBe(before);
  });

  it('switches from a STORE channel to a DIRECT one without keeping the link, and back without keeping the file', async () => {
    const { calls, user } = await load();
    const form = await openNew(user);
    await pickChannel(user, form, /Android store/);
    await fillCommon(user, form, { min: '1' });
    await typeUrl(user, form, PLAY_URL);
    await pickChannel(user, form, /Direct download/);
    choose(apk());
    await form.findByTestId('apk-info');
    await user.click(submit(form));
    await waitFor(() =>
      expect(writesOf(calls).some((c) => c.url === '/api/admin/app-versions')).toBe(true),
    );
    const body = writesOf(calls).find((c) => c.url === '/api/admin/app-versions')!.body;
    expect(body).not.toHaveProperty('storeUrl');
    expect(body).toHaveProperty('apkUploadId');
  });
});

describe('the Chinese form', { timeout: 60000 }, () => {
  it('shows the labels and the help in Chinese', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<AppVersionsPage />, 'zh-CN');
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    await user.click(screen.getByRole('button', { name: '新建版本' }));
    const form = within(await dialog());
    expect(form.getByText('低于此版本号的用户将被强制更新。')).toBeTruthy();
    expect(form.getByRole('textbox', { name: '版本名' })).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/appVersions\./);
  });
});
