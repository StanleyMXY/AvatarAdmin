import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import clientConfigMock from '../../../mock/clientConfig.mock';
import configMock from '../../../mock/config.mock';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import type { ClientConfigItem } from '../../services/clientConfig';
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

/** Opens the editor of a key of the mock backend. */
async function openKey(user: ReturnType<typeof userEvent.setup>, key: string) {
  await waitFor(() => expect(tableRows().length).toBe(19));
  await user.click(within(rowOf(key)).getByRole('button', { name: /Edit|View/ }));
  return screen.findByRole('dialog');
}
const valueBox = (drawer: HTMLElement, language = 'Default') =>
  within(drawer).getByRole('textbox', { name: `Value (${language})` });
const ARABIC_TITLE = ['\u0627\u0646\u0636\u0645', '\u0625\u0644\u064a', '\u{1F600} '].join(' ');
const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });
// While a save is under way the button's name carries the spinner's name ("loading Save").
const save = (drawer: HTMLElement) => within(drawer).getByRole('button', { name: /Save$/ });
const puts = (calls: { method: string; url: string; body?: unknown }[]) =>
  calls.filter((c) => c.method === 'PUT');
const addLanguage = async (
  user: ReturnType<typeof userEvent.setup>,
  drawer: HTMLElement,
  tag: string,
) => {
  const box = within(drawer).getByRole('combobox', {
    name: 'Language tag, for example th or zh-Hans',
  });
  await user.click(box);
  await user.clear(box);
  await user.type(box, tag);
  await user.click(within(drawer).getByRole('button', { name: 'Add language' }));
};

describe('the editor of a link key', () => {
  it('shows the default and every language as tabs with their values, and what the key is', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    const drawer = await openKey(user, 'privacyPolicyUrl');
    expect(within(drawer).getByText('Client configuration: privacyPolicyUrl')).toBeInTheDocument();
    expect(
      within(drawer)
        .getAllByRole('tab')
        .map((tab) => tab.textContent),
    ).toEqual(['Default', 'ar', 'th', 'zh-Hans']);
    expect((valueBox(drawer) as HTMLInputElement).value).toBe('https://example.com/privacy');
    await user.click(within(drawer).getByRole('tab', { name: 'th' }));
    expect((valueBox(drawer, 'th') as HTMLInputElement).value).toBe(
      'https://example.com/th/privacy',
    );
    expect(within(drawer).getByText('Last changed by root', { exact: false })).toBeInTheDocument();
  });

  it('refuses http:// and says why; nothing is sent', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    const drawer = await openKey(user, 'privacyPolicyUrl');
    type(valueBox(drawer), 'http://example.com/privacy');
    await user.click(save(drawer));
    expect(
      await within(drawer).findByText('The link must start with lowercase https://.'),
    ).toBeInTheDocument();
    expect(puts(calls).length).toBe(0);
  });

  it('refuses an empty value and a value of spaces only, for a URL', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    const drawer = await openKey(user, 'privacyPolicyUrl');
    type(valueBox(drawer), '');
    await user.click(save(drawer));
    expect(await within(drawer).findByText('It must not be empty.')).toBeInTheDocument();
    type(valueBox(drawer), `  ${String.fromCharCode(0x3000)} `);
    await user.click(save(drawer));
    expect(within(drawer).getByText('It must not be empty.')).toBeInTheDocument();
    expect(puts(calls).length).toBe(0);
  });

  it('saves the whole map of all languages in one request, the value without the whitespace at both ends', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    const drawer = await openKey(user, 'privacyPolicyUrl');
    type(valueBox(drawer), '  https://example.com/new-privacy \n');
    await user.click(save(drawer));
    await waitFor(() => expect(puts(calls).length).toBe(1));
    expect(puts(calls)[0].url).toBe('/api/admin/client-config/privacyPolicyUrl');
    expect(puts(calls)[0].body).toEqual({
      values: {
        '': 'https://example.com/new-privacy',
        ar: 'https://example.com/ar/privacy',
        th: 'https://example.com/th/privacy',
        'zh-Hans': 'https://example.com/zh/privacy',
      },
    });
    expect(await screen.findByText('Saved')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(writesOf(calls).length).toBe(1);
  });

  it('refuses the whole key when one language fails, marks that language on its tab, and sends nothing', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    const drawer = await openKey(user, 'privacyPolicyUrl');
    type(valueBox(drawer), 'https://example.com/changed-default');
    await user.click(within(drawer).getByRole('tab', { name: 'th' }));
    type(valueBox(drawer, 'th'), 'http://example.com/th');
    await user.click(within(drawer).getByRole('tab', { name: 'Default' }));
    await user.click(save(drawer));
    expect(
      await within(drawer).findByRole('tab', { name: /th.*has an error/ }),
    ).toBeInTheDocument();
    expect(within(drawer).getByRole('tab', { name: 'ar' })).toBeInTheDocument();
    expect(
      within(drawer).getByText(
        '1 language has a value that did not pass the check; the whole key was not saved.',
      ),
    ).toBeInTheDocument();
    expect(puts(calls).length).toBe(0);
    // the tab with the error is shown, with the reason under its value
    expect(
      await within(drawer).findByText('The link must start with lowercase https://.'),
    ).toBeInTheDocument();
    // the other languages are untouched in the editor
    expect(writesOf(calls).length).toBe(0);
  });

  it('counts every language that fails, not only the first', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    const drawer = await openKey(user, 'privacyPolicyUrl');
    for (const tag of ['th', 'ar']) {
      await user.click(within(drawer).getByRole('tab', { name: tag }));
      type(valueBox(drawer, tag), 'ftp://example.com');
    }
    await user.click(save(drawer));
    expect(
      await within(drawer).findByText(
        '2 languages have a value that did not pass the check; the whole key was not saved.',
      ),
    ).toBeInTheDocument();
  });

  it('saves again once the value is right', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    const drawer = await openKey(user, 'privacyPolicyUrl');
    await user.click(within(drawer).getByRole('tab', { name: 'th' }));
    type(valueBox(drawer, 'th'), 'http://example.com/th');
    await user.click(save(drawer));
    await within(drawer).findByRole('tab', { name: /th.*has an error/ });
    type(valueBox(drawer, 'th'), 'https://example.com/th-fixed');
    await user.click(save(drawer));
    await waitFor(() => expect(puts(calls).length).toBe(1));
    expect((puts(calls)[0].body as { values: Record<string, string> }).values.th).toBe(
      'https://example.com/th-fixed',
    );
  });

  it('keeps Save off while nothing is changed, and on again after an edit, and off again when put back', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    const drawer = await openKey(user, 'privacyPolicyUrl');
    expect(save(drawer)).toBeDisabled();
    type(valueBox(drawer), 'https://example.com/other');
    expect(save(drawer)).toBeEnabled();
    type(valueBox(drawer), 'https://example.com/privacy');
    expect(save(drawer)).toBeDisabled();
  });

  it('sends one request when Save is pressed twice', async () => {
    const calls = backend();
    const real = globalThis.fetch;
    let started = 0;
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL, init: RequestInit = {}) => {
        if ((init.method ?? 'GET').toUpperCase() === 'PUT') {
          started += 1;
          await gate;
        }
        return real(input, init);
      }),
    );
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    const drawer = await openKey(user, 'privacyPolicyUrl');
    type(valueBox(drawer), 'https://example.com/twice');
    const button = save(drawer);
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(started).toBe(1));
    release();
    await screen.findByText('Saved');
    expect(started).toBe(1);
    expect(puts(calls).length).toBe(1);
  });

  it('puts the languages the backend refused under their tabs, with the words of the reason, never the backend sentence', async () => {
    const calls = backend();
    const mocked = globalThis.fetch;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL, init: RequestInit = {}) =>
        (init.method ?? 'GET').toUpperCase() === 'PUT'
          ? jsonResponse(
              400,
              envelope(
                'INVALID_REQUEST',
                {
                  details: [
                    { ref: 'th', reason: 'INVALID_PATH' },
                    { ref: '', reason: 'TOO_LONG' },
                  ],
                },
                'SECRET backend sentence',
              ),
            )
          : mocked(input, init),
      ),
    );
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    const drawer = await openKey(user, 'privacyPolicyUrl');
    type(valueBox(drawer), 'https://example.com/changed');
    await user.click(save(drawer));
    expect(
      await within(drawer).findByRole('tab', { name: /th.*has an error/ }),
    ).toBeInTheDocument();
    expect(within(drawer).getByRole('tab', { name: /Default.*has an error/ })).toBeInTheDocument();
    expect(within(drawer).getByText('The value is too long.')).toBeInTheDocument();
    expect(
      within(drawer).getByText('The backend did not accept it; the whole key was not saved.'),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('SECRET backend sentence');
    expect(puts(calls).length).toBe(0);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('shows the words of another refusal and keeps the editor open', async () => {
    backend();
    const mocked = globalThis.fetch;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL, init: RequestInit = {}) =>
        (init.method ?? 'GET').toUpperCase() === 'PUT'
          ? jsonResponse(403, envelope('ADMIN_FORBIDDEN'))
          : mocked(input, init),
      ),
    );
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    const drawer = await openKey(user, 'privacyPolicyUrl');
    type(valueBox(drawer), 'https://example.com/changed');
    await user.click(save(drawer));
    expect(
      await within(drawer).findByText('You do not have permission to do this.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('is mounted only while open: after editing and closing, the next opening shows the saved values, not the edit', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    let drawer = await openKey(user, 'privacyPolicyUrl');
    type(valueBox(drawer), 'https://example.com/typed-and-dropped');
    await user.click(within(drawer).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    drawer = await openKey(user, 'privacyPolicyUrl');
    expect((valueBox(drawer) as HTMLInputElement).value).toBe('https://example.com/privacy');
    await user.click(within(drawer).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    drawer = await openKey(user, 'termsOfServiceUrl');
    expect(within(drawer).getByText('Client configuration: termsOfServiceUrl')).toBeInTheDocument();
    expect((valueBox(drawer) as HTMLInputElement).value).toBe('https://example.com/terms');
  });
});

describe('the languages of a key', () => {
  it('adds a language with an empty value, which must be filled, and sends it with the others', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    const drawer = await openKey(user, 'termsOfServiceUrl');
    await addLanguage(user, drawer, 'es');
    expect(await within(drawer).findByRole('tab', { name: 'es' })).toBeInTheDocument();
    await user.click(save(drawer));
    expect(await within(drawer).findByText('It must not be empty.')).toBeInTheDocument();
    expect(puts(calls).length).toBe(0);
    type(valueBox(drawer, 'es'), 'https://example.com/es/terms');
    await user.click(save(drawer));
    await waitFor(() => expect(puts(calls).length).toBe(1));
    expect(puts(calls)[0].body).toEqual({
      values: { '': 'https://example.com/terms', es: 'https://example.com/es/terms' },
    });
  });

  it('refuses a tag that is not valid and one that is there already', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    const drawer = await openKey(user, 'privacyPolicyUrl');
    await addLanguage(user, drawer, 'not a tag');
    expect(
      await within(drawer).findByText(
        'Not a valid language tag (for example th or zh-Hans, at most 35 characters)',
      ),
    ).toBeInTheDocument();
    await addLanguage(user, drawer, 'TH');
    expect(await within(drawer).findByText('This language is already added')).toBeInTheDocument();
    expect(within(drawer).getAllByRole('tab').length).toBe(4);
  });

  it('removes a language; the next save no longer carries it, and the text says that language then uses the default', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    const drawer = await openKey(user, 'privacyPolicyUrl');
    await user.click(within(drawer).getByRole('tab', { name: 'ar' }));
    expect(
      within(drawer).getByText('After saving, this language uses the default value.'),
    ).toBeInTheDocument();
    await user.click(
      within(drawer).getByRole('button', { name: 'Remove the value of this language' }),
    );
    await waitFor(() => expect(within(drawer).queryByRole('tab', { name: 'ar' })).toBeNull());
    await user.click(save(drawer));
    await waitFor(() => expect(puts(calls).length).toBe(1));
    expect(Object.keys((puts(calls)[0].body as { values: object }).values)).toEqual([
      '',
      'th',
      'zh-Hans',
    ]);
  });

  it('does not offer to remove the only value; resetting is the way to delete everything', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    const drawer = await openKey(user, 'termsOfServiceUrl');
    expect(
      within(drawer).queryByRole('button', { name: 'Remove the value of this language' }),
    ).toBeNull();
  });

  it('leaves the last value in place: the remove button goes when one value is left', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    const drawer = await openKey(user, 'privacyPolicyUrl');
    for (const tag of ['ar', 'th', 'zh-Hans']) {
      await user.click(within(drawer).getByRole('tab', { name: tag }));
      await user.click(
        within(drawer).getByRole('button', { name: 'Remove the value of this language' }),
      );
      await waitFor(() => expect(within(drawer).queryByRole('tab', { name: tag })).toBeNull());
    }
    expect(within(drawer).getAllByRole('tab').length).toBe(1);
    expect(
      within(drawer).queryByRole('button', { name: 'Remove the value of this language' }),
    ).toBeNull();
  });

  it('can remove the default value while a language stays; the next save has no empty-language entry', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    const drawer = await openKey(user, 'privacyPolicyUrl');
    await user.click(
      within(drawer).getByRole('button', { name: 'Remove the value of this language' }),
    );
    await waitFor(() => expect(within(drawer).queryByRole('tab', { name: 'Default' })).toBeNull());
    await user.click(save(drawer));
    await waitFor(() => expect(puts(calls).length).toBe(1));
    expect(Object.keys((puts(calls)[0].body as { values: object }).values)).toEqual([
      'ar',
      'th',
      'zh-Hans',
    ]);
  });

  it('has only the default for a key that is not per language, with no way to add a language', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    const drawer = await openKey(user, 'supportEmail');
    expect(
      within(drawer).getByText('This key is not per language; it has only the default value.'),
    ).toBeInTheDocument();
    expect(within(drawer).queryByRole('button', { name: 'Add language' })).toBeNull();
    expect(within(drawer).getAllByRole('tab').length).toBe(1);
  });

  it('starts a key that has no value with an empty list and a button to add the default value', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    const drawer = await openKey(user, 'supportUrl');
    expect(within(drawer).getByText('This key has no value yet.')).toBeInTheDocument();
    expect(save(drawer)).toBeDisabled();
    await user.click(within(drawer).getByRole('button', { name: 'Add the default value' }));
    type(valueBox(drawer), 'https://support.example.com/help');
    await user.click(save(drawer));
    await waitFor(() => expect(puts(calls).length).toBe(1));
    expect(puts(calls)[0].body).toEqual({ values: { '': 'https://support.example.com/help' } });
  });
});

describe('the other types', () => {
  it('EMAIL: refuses text that is not an address, saves an address trimmed', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    const drawer = await openKey(user, 'supportEmail');
    type(valueBox(drawer), 'not-an-address');
    await user.click(save(drawer));
    expect(await within(drawer).findByText('The email address is not valid.')).toBeInTheDocument();
    type(valueBox(drawer), '');
    await user.click(save(drawer));
    expect(await within(drawer).findByText('It must not be empty.')).toBeInTheDocument();
    type(valueBox(drawer), ' help@example.org ');
    await user.click(save(drawer));
    await waitFor(() => expect(puts(calls).length).toBe(1));
    expect(puts(calls)[0].body).toEqual({ values: { '': 'help@example.org' } });
  });

  it('STRING: keeps the text as typed, an empty text is a value, and Thai, Arabic and emoji pass', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    const drawer = await openKey(user, 'inviteShareTitle');
    await user.click(within(drawer).getByRole('tab', { name: 'ar' }));
    type(valueBox(drawer, 'ar'), ARABIC_TITLE);
    await user.click(within(drawer).getByRole('tab', { name: 'th' }));
    type(valueBox(drawer, 'th'), '');
    await user.click(save(drawer));
    await waitFor(() => expect(puts(calls).length).toBe(1));
    const values = (puts(calls)[0].body as { values: Record<string, string> }).values;
    expect(values.ar).toBe(ARABIC_TITLE);
    expect(values.th).toBe('');
  });

  it('INT: refuses a number with a fraction and an empty box, saves a whole number as a number', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    const drawer = await openKey(user, 'drivingLookaheadMs');
    await user.click(within(drawer).getByRole('button', { name: 'Add the default value' }));
    const box = within(drawer).getByRole('spinbutton', { name: 'Value (Default)' });
    await user.click(save(drawer));
    expect(await within(drawer).findByText('It must not be empty.')).toBeInTheDocument();
    type(box, '1.5');
    await user.click(save(drawer));
    expect(await within(drawer).findByText('It must be a whole number.')).toBeInTheDocument();
    expect(puts(calls).length).toBe(0);
    type(box, '250');
    await user.click(save(drawer));
    await waitFor(() => expect(puts(calls).length).toBe(1));
    expect(puts(calls)[0].body).toEqual({ values: { '': 250 } });
  });
});

describe('the keys that cannot be edited here', () => {
  it('shows a read-only key with its value, says where it comes from, and has no inputs, Save or Reset, also for an administrator who may manage', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    const drawer = await openKey(user, 'phoneLoginEnabled');
    expect(
      within(drawer).getByText(
        'Decided by the auth.phone_login_enabled setting; change it in System configuration',
      ),
    ).toBeInTheDocument();
    expect(within(drawer).queryByRole('button', { name: 'Save' })).toBeNull();
    expect(within(drawer).queryByRole('button', { name: 'Reset' })).toBeNull();
    expect(within(drawer).queryByRole('textbox')).toBeNull();
    expect(within(drawer).queryByRole('switch')).toBeNull();
    expect(within(drawer).queryByRole('button', { name: 'Add language' })).toBeNull();
    expect(within(drawer).getByTestId('readonly-value-default')).toHaveTextContent('No');
  });

  it('shows a list key (conversation languages) as the list it is, and the system as its source', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    const drawer = await openKey(user, 'conversationLanguages');
    expect(
      within(drawer).getByText(
        'Decided by the chat.conversation_languages setting; change it in System configuration',
      ),
    ).toBeInTheDocument();
    const tags = within(drawer).getByTestId('readonly-value-default');
    expect(tags.textContent).toContain('ar');
    expect(within(drawer).queryByRole('button', { name: 'Save' })).toBeNull();
  });

  it('does not break on a list key whose value is not a list, or a list with things that are not text', async () => {
    stubFetch(async () =>
      jsonResponse(
        200,
        envelope('200', {
          items: [
            item({
              key: 'conversationLanguages',
              type: 'STRING_LIST',
              localized: false,
              readOnly: true,
              values: { '': 'en,th' as never },
            }),
            item({
              key: 'otherList',
              type: 'STRING_LIST',
              localized: false,
              readOnly: true,
              values: { '': ['en', 5, null, { a: 1 }] as never },
            }),
          ],
        }),
      ),
    );
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    await waitFor(() => expect(tableRows().length).toBe(2));
    await user.click(within(rowOf('conversationLanguages')).getByRole('button', { name: 'View' }));
    let drawer = await screen.findByRole('dialog');
    expect(within(drawer).getByTestId('readonly-value-default')).toHaveTextContent('en,th');
    await user.click(within(drawer).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await user.click(within(rowOf('otherList')).getByRole('button', { name: 'View' }));
    drawer = await screen.findByRole('dialog');
    expect(within(drawer).getByTestId('readonly-value-default')).toHaveTextContent('en');
  });

  it('treats a list key that the interface does not mark read only as not editable too', async () => {
    fixed([
      item({
        key: 'wordList',
        type: 'STRING_LIST',
        localized: false,
        readOnly: false,
        values: { '': ['a', 'b'] },
      }),
    ]);
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    await waitFor(() => expect(tableRows().length).toBe(1));
    await user.click(within(tableRows()[0]).getByRole('button', { name: 'View' }));
    const drawer = await screen.findByRole('dialog');
    expect(
      within(drawer).getByText(
        'This key is a list derived by the system; it cannot be edited here.',
      ),
    ).toBeInTheDocument();
    expect(within(drawer).queryByRole('button', { name: 'Save' })).toBeNull();
    expect(within(drawer).queryByRole('button', { name: 'Reset' })).toBeNull();
  });

  it('shows the values of an administrator without CLIENTCONFIG:MANAGE as text, with no inputs, Save or Reset', async () => {
    signIn('reviewer', { codes: ['CLIENTCONFIG:VIEW'] });
    backend();
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    const drawer = await openKey(user, 'privacyPolicyUrl');
    expect(within(drawer).queryByRole('button', { name: 'Save' })).toBeNull();
    expect(within(drawer).queryByRole('button', { name: 'Reset' })).toBeNull();
    expect(within(drawer).queryByRole('textbox')).toBeNull();
    expect(within(drawer).queryByRole('button', { name: 'Add language' })).toBeNull();
    expect(within(drawer).getByTestId('readonly-value-th')).toHaveTextContent(
      'https://example.com/th/privacy',
    );
    expect(within(drawer).getByTestId('readonly-value-default')).toHaveTextContent(
      'https://example.com/privacy',
    );
  });
});

const fixed = (items: unknown[]) =>
  stubFetch(async () => jsonResponse(200, envelope('200', { items })));

describe('reset', () => {
  it('asks inline first and sends nothing when cancelled', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    const drawer = await openKey(user, 'privacyPolicyUrl');
    await user.click(within(drawer).getByRole('button', { name: 'Reset' }));
    expect(
      await screen.findByText(
        'Delete the values of privacyPolicyUrl in every language? The client goes back to the default.',
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(writesOf(calls).length).toBe(0);
  });

  it('deletes every language of the key once confirmed: one request, then the list shows it as not configured', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    const drawer = await openKey(user, 'privacyPolicyUrl');
    await user.click(within(drawer).getByRole('button', { name: 'Reset' }));
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    await waitFor(() => expect(writesOf(calls).length).toBe(1));
    expect(writesOf(calls)[0]).toMatchObject({
      method: 'POST',
      url: '/api/admin/client-config/privacyPolicyUrl/reset',
    });
    expect(await screen.findByText('Reset done')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() =>
      expect(within(rowOf('privacyPolicyUrl')).getByText('Not configured')).toBeInTheDocument(),
    );
    expect(clientConfigState.rows.has('privacyPolicyUrl')).toBe(false);
  });

  it('sends one request when the confirmation is pressed twice', async () => {
    const calls = backend();
    const real = globalThis.fetch;
    let started = 0;
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL, init: RequestInit = {}) => {
        if ((init.method ?? 'GET').toUpperCase() === 'POST') {
          started += 1;
          await gate;
        }
        return real(input, init);
      }),
    );
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    const drawer = await openKey(user, 'privacyPolicyUrl');
    await user.click(within(drawer).getByRole('button', { name: 'Reset' }));
    const ok = await screen.findByRole('button', { name: 'OK' });
    fireEvent.click(ok);
    fireEvent.click(ok);
    fireEvent.click(ok);
    await waitFor(() => expect(started).toBe(1));
    release();
    await screen.findByText('Reset done');
    expect(started).toBe(1);
    expect(writesOf(calls).length).toBe(1);
  });

  it('is off for a key that is not configured, and says there is nothing to reset', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    const drawer = await openKey(user, 'supportUrl');
    expect(within(drawer).getByRole('button', { name: 'Reset' })).toBeDisabled();
    expect(
      within(drawer).getByText('This key is not configured; there is no value to reset.'),
    ).toBeInTheDocument();
  });

  it('shows the words of a refusal and keeps the editor', async () => {
    backend();
    const mocked = globalThis.fetch;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL, init: RequestInit = {}) =>
        (init.method ?? 'GET').toUpperCase() === 'POST'
          ? jsonResponse(400, envelope('INVALID_REQUEST', null, 'SECRET words'))
          : mocked(input, init),
      ),
    );
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    const drawer = await openKey(user, 'privacyPolicyUrl');
    await user.click(within(drawer).getByRole('button', { name: 'Reset' }));
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    expect(
      await screen.findByText('Some input is not valid. Please check the fields and try again.'),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('SECRET words');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('the preview', () => {
  const preview = (drawer: HTMLElement) => ({
    value: within(drawer).getByTestId('preview-value').textContent,
    source: within(drawer).getByTestId('preview-source').textContent,
    from: within(drawer).getByTestId('preview-from').textContent,
  });
  const chooseLanguage = async (
    user: ReturnType<typeof userEvent.setup>,
    drawer: HTMLElement,
    tag: string,
  ) => {
    const box = within(drawer).getByRole('combobox', { name: 'Language' });
    await user.click(box);
    await user.clear(box);
    await user.type(box, tag);
  };

  it('shows the value of the chosen language and marks the source as that language', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    const drawer = await openKey(user, 'privacyPolicyUrl');
    await chooseLanguage(user, drawer, 'th');
    await waitFor(() => expect(preview(drawer).source).toBe('That language'));
    expect(preview(drawer)).toEqual({
      value: 'https://example.com/th/privacy',
      source: 'That language',
      from: 'Taken from the value of language th',
    });
  });

  it('marks the default value as the source for a language the key has no value for', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    const drawer = await openKey(user, 'privacyPolicyUrl');
    await chooseLanguage(user, drawer, 'es');
    await waitFor(() => expect(preview(drawer).source).toBe('Default value'));
    expect(preview(drawer)).toEqual({
      value: 'https://example.com/privacy',
      source: 'Default value',
      from: 'Taken from the default value without a language',
    });
  });

  it('follows the negotiation: a regional tag finds the language of the key, zh-CN finds zh-Hans', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    const drawer = await openKey(user, 'privacyPolicyUrl');
    await chooseLanguage(user, drawer, 'th-TH');
    await waitFor(() => expect(preview(drawer).from).toBe('Taken from the value of language th'));
    await chooseLanguage(user, drawer, 'zh-CN');
    await waitFor(() =>
      expect(preview(drawer).from).toBe('Taken from the value of language zh-Hans'),
    );
    expect(preview(drawer).value).toBe('https://example.com/zh/privacy');
  });

  it('says "not configured" when there is no value at all, and what the client does then', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    const drawer = await openKey(user, 'supportUrl');
    expect(preview(drawer)).toEqual({
      value: '—',
      source: 'Not configured',
      from: 'No value: the client treats it as "entry not shown"',
    });
  });

  it('uses the registered default of a key that has no value, and says so', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    const drawer = await openKey(user, 'drivingLookaheadMs');
    expect(preview(drawer)).toEqual({
      value: '200',
      source: 'Default value',
      from: 'Taken from the registered default',
    });
  });

  it('shows what is being edited, and says it is not saved yet', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    const drawer = await openKey(user, 'privacyPolicyUrl');
    expect(
      within(drawer).queryByText('The preview includes changes that are not saved yet.'),
    ).toBeNull();
    type(valueBox(drawer), 'https://example.com/edited-default');
    await chooseLanguage(user, drawer, 'es');
    await waitFor(() => expect(preview(drawer).value).toBe('https://example.com/edited-default'));
    expect(
      within(drawer).getByText('The preview includes changes that are not saved yet.'),
    ).toBeInTheDocument();
  });

  it('shows a switch as Yes or No, a number as a number, and a read-only key with its system value', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    const drawer = await openKey(user, 'phoneLoginEnabled');
    expect(preview(drawer).value).toBe('No');
    expect(preview(drawer).source).toBe('Default value');
  });

  it('ignores the languages of a key that is not per language', async () => {
    fixed([
      item({
        key: 'supportEmail',
        type: 'EMAIL',
        localized: false,
        values: { '': 'a@example.com', th: 'b@example.com' },
      }),
    ]);
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    await waitFor(() => expect(tableRows().length).toBe(1));
    await user.click(within(tableRows()[0]).getByRole('button', { name: 'Edit' }));
    const drawer = await screen.findByRole('dialog');
    await chooseLanguage(user, drawer, 'th');
    await waitFor(() => expect(preview(drawer).value).toBe('a@example.com'));
    expect(preview(drawer).source).toBe('Default value');
  });

  it('keeps a value of 5000 characters without a space inside the box', async () => {
    fixed([item({ key: 'inviteShareTitle', type: 'STRING', values: { '': 'ก็'.repeat(2500) } })]);
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    await waitFor(() => expect(tableRows().length).toBe(1));
    await user.click(within(tableRows()[0]).getByRole('button', { name: 'Edit' }));
    const drawer = await screen.findByRole('dialog');
    const shown = within(drawer).getByTestId('preview-value');
    expect(getComputedStyle(shown).overflowWrap).toBe('anywhere');
  });
});

describe('values that are not what the contract says', () => {
  it('shows a link key whose value is a number, an object and null as text and does not break', async () => {
    fixed([
      item({
        values: { '': 5 as never, th: { a: 1 } as never, ar: null as never, 'not a tag': 'x' },
      }),
    ]);
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    await waitFor(() => expect(tableRows().length).toBe(1));
    await user.click(within(tableRows()[0]).getByRole('button', { name: 'Edit' }));
    const drawer = await screen.findByRole('dialog');
    expect((valueBox(drawer) as HTMLInputElement).value).toBe('5');
    expect(within(drawer).getByRole('tab', { name: 'not a tag' })).toBeInTheDocument();
  });

  it('does not break on values that is not an object', async () => {
    fixed([item({ values: 'x' as never }), item({ key: 'b', values: null as never })]);
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    await waitFor(() => expect(tableRows().length).toBe(2));
    await user.click(within(tableRows()[0]).getByRole('button', { name: 'Edit' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('does not break on a switch whose value is text', async () => {
    fixed([
      item({ key: 'flag', type: 'BOOLEAN', localized: false, values: { '': 'yes' as never } }),
    ]);
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    await waitFor(() => expect(tableRows().length).toBe(1));
    await user.click(within(tableRows()[0]).getByRole('button', { name: 'Edit' }));
    const drawer = await screen.findByRole('dialog');
    expect(within(drawer).getByRole('switch')).toBeInTheDocument();
  });
});

describe('a switch', () => {
  it('saves true or false as a boolean', async () => {
    const stored: unknown[] = [];
    stubFetch(async ({ init }) => {
      if (init.method === 'PUT') {
        stored.push(JSON.parse(init.body as string));
        return jsonResponse(200, envelope('200', {}));
      }
      return jsonResponse(
        200,
        envelope('200', {
          items: [item({ key: 'flag', type: 'BOOLEAN', localized: false, values: { '': false } })],
        }),
      );
    });
    const user = userEvent.setup();
    renderPage(<ClientConfigPage />);
    await waitFor(() => expect(tableRows().length).toBe(1));
    await user.click(within(tableRows()[0]).getByRole('button', { name: 'Edit' }));
    const drawer = await screen.findByRole('dialog');
    await user.click(within(drawer).getByRole('switch'));
    await user.click(save(drawer));
    await waitFor(() => expect(stored.length).toBe(1));
    expect(stored[0]).toEqual({ values: { '': true } });
  });
});
