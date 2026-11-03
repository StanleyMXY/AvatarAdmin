// What the version pages say when the backend refuses (contract 24.2, answers 47 and 92): a 409 by
// the value of `data.status`, and a 400 by the `ref` and `reason` of each detail. The backend's own
// words are never shown; a 400 whose `data` is null (the file checks of an activation, an upload
// address that is not set, a file changed during the check) gets the general words and no field.
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import appVersionsMock from '../../../mock/appVersions.mock';
import channelsMock from '../../../mock/channels.mock';
import { fileOf, zipBytes } from '../../../tests/imageBytes';
import { useMockBackend } from '../../../tests/mockBackend';
import { must } from '../../../tests/must';
import { renderPage } from '../../../tests/renderPage';
import enUS from '../../locales/en-US';
import zhCN from '../../locales/zh-CN';
import {
  appVersionsState,
  channelsState,
  jsonAnswer,
  META,
  overrideFetch,
  signIn,
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
const load = async (locale?: 'zh-CN') => {
  const calls = backend();
  const user = userEvent.setup();
  renderPage(<AppVersionsPage />, locale);
  await waitFor(() => expect(rows().length).toBeGreaterThan(0));
  return { calls, user };
};
const dialog = () => screen.findByRole('dialog');
const openNew = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'New version' }));
  return within(await dialog());
};
const openEdit = async (user: ReturnType<typeof userEvent.setup>, id: string) => {
  await user.click(within(await rowOf(id)).getByRole('button', { name: 'Edit' }));
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
const submit = (form: ReturnType<typeof within>) =>
  form.getByRole('button', { name: /^(loading )?Submit$/ });
const PLAY_URL = 'https://play.google.com/store/apps/details?id=app.example.play';
const choose = (file: File) =>
  fireEvent.change(screen.getByTestId('upload-input'), { target: { files: [file] } });
const apk = () => fileOf(zipBytes(), 'avatar.apk');

/** A new STORE version filled in so that the page itself lets it go. */
const fillStore = async (
  user: ReturnType<typeof userEvent.setup>,
  form: ReturnType<typeof within>,
) => {
  await pickChannel(user, form, /Android store/);
  await user.type(form.getByRole('textbox', { name: 'Version name' }), '1.3.0');
  await user.type(form.getByRole('spinbutton', { name: 'Version number' }), '130');
  await user.type(form.getByRole('spinbutton', { name: 'Minimum version number' }), '110');
  await user.type(form.getByRole('textbox', { name: 'en' }), 'Faster calls');
  await user.click(form.getByRole('textbox', { name: 'Store link' }));
  await user.paste(PLAY_URL);
};

const refuseWrite = (
  status: number,
  code: string,
  data: unknown,
  path = '/api/admin/app-versions',
) =>
  overrideFetch(async ({ method, url }) =>
    method !== 'GET' && url.pathname === path
      ? jsonAnswer(status, code, data, 'BACKEND WORDS THAT MUST NOT SHOW')
      : undefined,
  );

const itemOf = (text: string) =>
  screen.findByText(text).then((node) => node.closest('.ant-form-item') as HTMLElement);

describe('a 409 INVALID_STATE of a save says what data.status says', { timeout: 60000 }, () => {
  const STORE_TEXT = {
    DISABLED: enUS['appVersions.state.DISABLED'],
    CONSUMED: enUS['appVersions.state.CONSUMED'],
  } as const;

  it.each([
    ['DISABLED', STORE_TEXT.DISABLED],
    ['DRAFT', 'Draft'],
    ['ACTIVE', 'Active'],
    ['ARCHIVED', 'Archived'],
  ])('creating: %s', async (status, expected) => {
    const { user } = await load();
    const form = await openNew(user);
    await fillStore(user, form);
    refuseWrite(409, 'INVALID_STATE', { status });
    await user.click(submit(form));
    const alert = (await form.findAllByRole('alert')).at(-1) as HTMLElement;
    await waitFor(() => expect(alert.textContent).toContain(expected));
    if (status === 'DISABLED') {
      expect(form.queryByText(enUS['error.INVALID_STATE'])).toBeNull();
    } else {
      expect(alert.textContent).toContain(`"${expected}"`);
    }
    expect(document.body.textContent).not.toContain('BACKEND WORDS THAT MUST NOT SHOW');
    expect(form.queryByText(enUS['appVersions.apk.rejected'])).toBeNull();
  });

  it('CONSUMED on a DIRECT version: says the upload was used, asks for the file again, sends nothing more', async () => {
    const { user } = await load();
    const form = await openNew(user);
    await user.click(form.getByRole('combobox', { name: 'Channel package' }));
    const options = await screen.findAllByText(/Direct download/, {
      selector: '.ant-select-item-option-content',
    });
    await user.click(options[options.length - 1]);
    await user.type(form.getByRole('textbox', { name: 'Version name' }), '1.3.0');
    await user.type(form.getByRole('spinbutton', { name: 'Version number' }), '130');
    await user.type(form.getByRole('spinbutton', { name: 'Minimum version number' }), '1');
    await user.type(form.getByRole('textbox', { name: 'en' }), 'Faster calls');
    choose(apk());
    await form.findByTestId('apk-info');
    const sent = refuseWrite(409, 'INVALID_STATE', { status: 'CONSUMED' });
    await user.click(submit(form));
    expect(await form.findByText(STORE_TEXT.CONSUMED)).toBeTruthy();
    expect(await form.findByText(enUS['appVersions.apk.rejected'])).toBeTruthy();
    expect(form.queryByTestId('apk-info')).toBeNull();
    expect(form.queryByText(enUS['error.INVALID_STATE'])).toBeNull();
    await user.click(submit(form));
    expect(await form.findByText(enUS['appVersions.apk.required'])).toBeTruthy();
    expect(sent).toHaveLength(1);
  });

  it.each([
    ['no data', null],
    ['an empty object', {}],
    ['the old guess CHANNEL_DISABLED', { status: 'CHANNEL_DISABLED' }],
    ['the old guess UPLOAD_USED', { status: 'UPLOAD_USED' }],
    ['the old guess USED', { status: 'USED' }],
    ['small letters', { status: 'disabled' }],
    ['a status that is not text', { status: 5 }],
  ])('the general words of the code for %s, and the file is kept', async (_name, data) => {
    const { user } = await load();
    const form = await openNew(user);
    await user.click(form.getByRole('combobox', { name: 'Channel package' }));
    const options = await screen.findAllByText(/Direct download/, {
      selector: '.ant-select-item-option-content',
    });
    await user.click(options[options.length - 1]);
    await user.type(form.getByRole('textbox', { name: 'Version name' }), '1.3.0');
    await user.type(form.getByRole('spinbutton', { name: 'Version number' }), '130');
    await user.type(form.getByRole('spinbutton', { name: 'Minimum version number' }), '1');
    await user.type(form.getByRole('textbox', { name: 'en' }), 'Faster calls');
    choose(apk());
    await form.findByTestId('apk-info');
    refuseWrite(409, 'INVALID_STATE', data);
    await user.click(submit(form));
    expect(await form.findByText(enUS['error.INVALID_STATE'])).toBeTruthy();
    expect(form.getByTestId('apk-info')).toBeTruthy();
    expect(form.queryByText(enUS['appVersions.apk.rejected'])).toBeNull();
  });

  it('the mock backend gives the states: a channel that is off is DISABLED, a draft that was activated meanwhile is ACTIVE', async () => {
    const { user } = await load();
    const draft = versionBy('play', 120);
    const form = await openEdit(user, draft.id);
    must(appVersionsState.versions.get(draft.id)).status = 'ACTIVE';
    await user.click(submit(form));
    expect(await form.findByText(/The state of this version is "Active" now/)).toBeTruthy();
  });

  it('says it in Chinese in the Chinese page', async () => {
    const { user } = await load('zh-CN');
    const draft = versionBy('play', 120);
    await user.click(within(await rowOf(draft.id)).getByRole('button', { name: '编辑' }));
    const form = within(await dialog());
    must(appVersionsState.versions.get(draft.id)).status = 'ARCHIVED';
    await user.click(form.getByRole('button', { name: /^(loading )?提\s*交$/ }));
    expect(
      await form.findByText(zhCN['appVersions.state.version'].replace('{state}', '已归档')),
    ).toBeTruthy();
  });
});

describe('a channel that is off: the mock backend says DISABLED to a new version', {
  timeout: 60000,
}, () => {
  it('shows the words of the channel, not those of a version', async () => {
    const { user } = await load();
    const form = await openNew(user);
    await fillStore(user, form);
    must(channelsState.channels.get('play')).enabled = false;
    await user.click(submit(form));
    expect(await form.findByText(enUS['appVersions.state.DISABLED'])).toBeTruthy();
  });
});

describe('a 400 INVALID_REQUEST with details goes under the field it names', {
  timeout: 60000,
}, () => {
  const cases: [string, string, string][] = [
    ['versionName', 'INVALID_FORMAT', 'Version name'],
    ['versionCode', 'OUT_OF_RANGE', 'Version number'],
    ['minVersionCode', 'OUT_OF_RANGE', 'Minimum version number'],
    ['storeUrl', 'NOT_HTTPS', 'Store link'],
    ['storeUrl', 'INVALID_HOST', 'Store link'],
    ['storeUrl', 'INVALID_PORT', 'Store link'],
    ['storeUrl', 'INVALID_PATH', 'Store link'],
    ['storeUrl', 'TOO_LONG', 'Store link'],
    ['storeUrl', 'PACKAGE_NAME_NOT_CONFIGURED', 'Store link'],
    ['storeUrl', 'EMPTY_NOT_ALLOWED', 'Store link'],
    ['channelCode', 'OUT_OF_RANGE', 'Channel package'],
    ['changelog', 'EMPTY_NOT_ALLOWED', 'Update notes'],
  ];
  it.each(cases)('%s with %s', async (ref, reason, label) => {
    const { user } = await load();
    const form = await openNew(user);
    await fillStore(user, form);
    refuseWrite(400, 'INVALID_REQUEST', { details: [{ ref, reason }] });
    await user.click(submit(form));
    const item = await itemOf(enUS[`reason.${reason}` as keyof typeof enUS]);
    expect(within(item).getByText(label)).toBeTruthy();
    // The general sentence is not the only thing said, and the backend's words are not shown.
    expect(document.body.textContent).not.toContain('BACKEND WORDS THAT MUST NOT SHOW');
  });

  it('puts the reason of a language under the text of that language, brings its tab into view and marks the other refused tabs', async () => {
    const { user } = await load();
    const form = await openNew(user);
    await fillStore(user, form);
    refuseWrite(400, 'INVALID_REQUEST', {
      details: [
        { ref: 'changelog.th', reason: 'EMPTY_NOT_ALLOWED' },
        { ref: 'changelog.ar', reason: 'OUT_OF_RANGE' },
      ],
    });
    await user.click(submit(form));
    expect((await form.findByTestId('note-reason-th')).textContent).toBe(
      enUS['reason.EMPTY_NOT_ALLOWED'],
    );
    expect(form.getByRole('textbox', { name: 'th' })).toBeTruthy();
    expect(form.getByTestId('note-refused-th')).toBeTruthy();
    expect(form.getByTestId('note-refused-ar')).toBeTruthy();
    expect(form.queryByTestId('note-refused-en')).toBeNull();
    await user.click(form.getByRole('tab', { name: /ar/ }));
    expect((await form.findByTestId('note-reason-ar')).textContent).toBe(
      enUS['reason.OUT_OF_RANGE'],
    );
  });

  it('takes the reason of a language away when its text is edited, and leaves the others', async () => {
    const { user } = await load();
    const form = await openNew(user);
    await fillStore(user, form);
    refuseWrite(400, 'INVALID_REQUEST', {
      details: [
        { ref: 'changelog.en', reason: 'OUT_OF_RANGE' },
        { ref: 'changelog.th', reason: 'OUT_OF_RANGE' },
      ],
    });
    await user.click(submit(form));
    await form.findByTestId('note-reason-en');
    await user.type(form.getByRole('textbox', { name: 'en' }), '!');
    await waitFor(() => expect(form.queryByTestId('note-reason-en')).toBeNull());
    expect(form.queryByTestId('note-refused-en')).toBeNull();
    expect(form.getByTestId('note-refused-th')).toBeTruthy();
  });

  it('says a refused language that has no tab below the tabs, with the language', async () => {
    const { user } = await load();
    const form = await openNew(user);
    await fillStore(user, form);
    refuseWrite(400, 'INVALID_REQUEST', {
      details: [{ ref: 'changelog.zz-ä', reason: 'INVALID_LANGUAGE_TAG' }],
    });
    await user.click(submit(form));
    expect(await form.findByText(`zz-ä: ${enUS['reason.INVALID_LANGUAGE_TAG']}`)).toBeTruthy();
  });

  it('a refusal of the whole notes goes under the notes, and one of the version name under its own field', async () => {
    const { user } = await load();
    const form = await openNew(user);
    await fillStore(user, form);
    refuseWrite(400, 'INVALID_REQUEST', {
      details: [
        { ref: 'versionName', reason: 'INVALID_FORMAT' },
        { ref: 'changelog', reason: 'OUT_OF_RANGE' },
      ],
    });
    await user.click(submit(form));
    const name = await itemOf(enUS['reason.INVALID_FORMAT']);
    expect(within(name).getByText('Version name')).toBeTruthy();
    const notes = await itemOf(enUS['reason.OUT_OF_RANGE']);
    expect(within(notes).getByText('Update notes')).toBeTruthy();
  });

  it('the Chinese page writes the reason and the language in Chinese', async () => {
    const { user } = await load('zh-CN');
    const form = within(
      await (async () => {
        await user.click(screen.getByRole('button', { name: '新建版本' }));
        return dialog();
      })(),
    );
    await user.click(form.getByRole('combobox', { name: '渠道包' }));
    const options = await screen.findAllByText(/Android/, {
      selector: '.ant-select-item-option-content',
    });
    await user.click(options[options.length - 1]);
    await user.type(form.getByRole('textbox', { name: '版本名' }), '1.3.0');
    await user.type(form.getByRole('spinbutton', { name: '版本号' }), '130');
    await user.type(form.getByRole('spinbutton', { name: '最低版本号' }), '110');
    await user.type(form.getByRole('textbox', { name: 'en' }), 'Faster calls');
    await user.click(form.getByRole('textbox', { name: '商店链接' }));
    await user.paste(PLAY_URL);
    refuseWrite(400, 'INVALID_REQUEST', {
      details: [{ ref: 'changelog.th', reason: 'INVALID_LANGUAGE_TAG' }],
    });
    await user.click(form.getByRole('button', { name: /^(loading )?提\s*交$/ }));
    expect((await form.findByTestId('note-reason-th')).textContent).toBe(
      zhCN['reason.INVALID_LANGUAGE_TAG'],
    );
  });

  it('a field that is not on this form is named in the bar with its label, not left as a bare reason', async () => {
    const { user } = await load();
    const form = await openNew(user);
    await fillStore(user, form);
    refuseWrite(400, 'INVALID_REQUEST', {
      details: [{ ref: 'apkUploadId', reason: 'OUT_OF_RANGE' }],
    });
    await user.click(submit(form));
    expect(await form.findByText(`APK file: ${enUS['reason.OUT_OF_RANGE']}`)).toBeTruthy();
  });

  it('a reason that has no words in the language file is not shown as a code of the page', async () => {
    const { user } = await load();
    const form = await openNew(user);
    await fillStore(user, form);
    refuseWrite(400, 'INVALID_REQUEST', {
      details: [
        { ref: 'versionCode', reason: 'SOMETHING_NEW' },
        { ref: 'versionName', reason: 'ANOTHER_NEW' },
      ],
    });
    await user.click(submit(form));
    await form.findByText('SOMETHING_NEW');
    expect(document.body.textContent).not.toContain('BACKEND WORDS THAT MUST NOT SHOW');
  });
});

describe('a 400 whose data is null is not read for details', { timeout: 60000 }, () => {
  it('a save: the general words of the code, no field marked, the typed values kept', async () => {
    const { user } = await load();
    const form = await openNew(user);
    await fillStore(user, form);
    refuseWrite(400, 'INVALID_REQUEST', null);
    await user.click(submit(form));
    expect(await form.findByText(enUS['error.INVALID_REQUEST'])).toBeTruthy();
    expect(document.querySelectorAll('.ant-form-item-explain-error')).toHaveLength(0);
    expect(form.getByRole('textbox', { name: 'Version name' })).toHaveValue('1.3.0');
    expect(document.body.textContent).not.toContain('BACKEND WORDS THAT MUST NOT SHOW');
  });

  it('an activation: the same, whatever the file check was (the backend answers with a message only)', async () => {
    const { user } = await load();
    const direct = versionBy('direct', 120);
    await user.click(within(await rowOf(direct.id)).getByRole('button', { name: 'Activate' }));
    const box = within(await dialog());
    refuseWrite(400, 'INVALID_REQUEST', null, `/api/admin/app-versions/${direct.id}/status`);
    await user.click(box.getByRole('button', { name: /^(loading )?Activate$/ }));
    expect(await box.findByText(enUS['error.INVALID_REQUEST'])).toBeTruthy();
    expect(box.queryByRole('list')).toBeNull();
  });

  it('the mock backend refuses the activation of a DIRECT version whose stored file is not as it was uploaded with a message only', async () => {
    const { user } = await load();
    const direct = versionBy('direct', 120);
    appVersionsState.storedFileFault = true;
    await user.click(within(await rowOf(direct.id)).getByRole('button', { name: 'Activate' }));
    const box = within(await dialog());
    await user.click(box.getByRole('button', { name: /^(loading )?Activate$/ }));
    expect(await box.findByText(enUS['error.INVALID_REQUEST'])).toBeTruthy();
    expect(appVersionsState.versions.get(direct.id)?.status).toBe('DRAFT');
  });
});

describe('the activation dialog', { timeout: 60000 }, () => {
  const open = async (user: ReturnType<typeof userEvent.setup>, id: string) => {
    await user.click(within(await rowOf(id)).getByRole('button', { name: 'Activate' }));
    return within(await dialog());
  };
  const live = (box: ReturnType<typeof within>) =>
    box.getByRole('checkbox', { name: enUS['appVersions.activate.confirmLive'] });

  it.each([
    ['DISABLED', enUS['appVersions.state.DISABLED']],
    ['ACTIVE', 'The state of this version is "Active" now'],
    ['ARCHIVED', 'The state of this version is "Archived" now'],
    ['DRAFT', 'The state of this version is "Draft" now'],
  ])('a 409 with %s', async (status, expected) => {
    const { user } = await load();
    const draft = versionBy('play', 120);
    const box = await open(user, draft.id);
    await user.click(live(box));
    refuseWrite(409, 'INVALID_STATE', { status }, `/api/admin/app-versions/${draft.id}/status`);
    await user.click(box.getByRole('button', { name: /^(loading )?Activate$/ }));
    expect(
      await box.findByText(new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))),
    ).toBeTruthy();
    expect(box.queryByText(enUS['error.INVALID_STATE'])).toBeNull();
    expect(document.body.textContent).not.toContain('BACKEND WORDS THAT MUST NOT SHOW');
  });

  it('a 409 with no status keeps the general words', async () => {
    const { user } = await load();
    const draft = versionBy('play', 120);
    const box = await open(user, draft.id);
    await user.click(live(box));
    refuseWrite(409, 'INVALID_STATE', null, `/api/admin/app-versions/${draft.id}/status`);
    await user.click(box.getByRole('button', { name: /^(loading )?Activate$/ }));
    expect(await box.findByText(enUS['error.INVALID_STATE'])).toBeTruthy();
  });

  it('a 400 about the store confirmation is told as a request to tick the box, a 400 about the number is named by its field', async () => {
    const { user } = await load();
    const draft = versionBy('play', 120);
    const box = await open(user, draft.id);
    await user.click(live(box));
    refuseWrite(
      400,
      'INVALID_REQUEST',
      {
        details: [
          { ref: 'confirmStoreLive', reason: 'EMPTY_NOT_ALLOWED' },
          { ref: 'versionCode', reason: 'OUT_OF_RANGE' },
          { ref: 'status', reason: 'OUT_OF_RANGE' },
        ],
      },
      `/api/admin/app-versions/${draft.id}/status`,
    );
    await user.click(box.getByRole('button', { name: /^(loading )?Activate$/ }));
    expect(await box.findByText(enUS['appVersions.activate.confirmRequired'])).toBeTruthy();
    expect(box.getByText(`Version number: ${enUS['reason.OUT_OF_RANGE']}`)).toBeTruthy();
    expect(box.getByText(`New state: ${enUS['reason.OUT_OF_RANGE']}`)).toBeTruthy();
  });
});

describe('the row actions', { timeout: 60000 }, () => {
  it('deleting a draft that was taken down meanwhile says the state of the version', async () => {
    const { user } = await load();
    const draft = versionBy('play', 120);
    const row = await rowOf(draft.id);
    must(appVersionsState.versions.get(draft.id)).status = 'ARCHIVED';
    await user.click(within(row).getByRole('button', { name: 'Delete' }));
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    expect(await screen.findByText(/The state of this version is "Archived" now/)).toBeTruthy();
    expect(appVersionsState.versions.has(draft.id)).toBe(true);
  });

  it('taking down a version that is no longer active says its state', async () => {
    const { user } = await load();
    const active = versionBy('play', 110);
    const row = await rowOf(active.id);
    must(appVersionsState.versions.get(active.id)).status = 'ARCHIVED';
    await user.click(within(row).getByRole('button', { name: 'Take down' }));
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    expect(await screen.findByText(/The state of this version is "Archived" now/)).toBeTruthy();
  });
});
