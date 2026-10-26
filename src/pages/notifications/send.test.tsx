import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { USER, usersState } from '../../../mock/_core/usersData';
import notificationsMock from '../../../mock/notifications.mock';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import enUS from '../../locales/en-US';
import { SCREEN_TARGETS } from '../../utils/screenTargets';
import NotificationsPage from './list';
import { META, notificationsState, signIn, writesOf } from './testSetup';

vi.setConfig({ testTimeout: 30000 });

beforeEach(() => signIn('root'));
afterEach(() => vi.unstubAllGlobals());

const ACTIVE = () => usersState.users.filter((u) => u.status === 'ACTIVE').map((u) => u.id);
const IDEOGRAPHIC = String.fromCharCode(0x3000);

const openDialog = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('button', { name: 'Send notifications' }));
  return screen.findByRole('dialog');
};
const recipientsBox = (dialog: HTMLElement) =>
  within(dialog).getByRole('textbox', { name: 'Recipients' });
const titleBox = (dialog: HTMLElement, locale = 'en') =>
  within(dialog).getByRole('textbox', { name: `Title (${locale})` });
const bodyBox = (dialog: HTMLElement, locale = 'en') =>
  within(dialog).getByRole('textbox', { name: `Body (${locale})` });
const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });
const submit = (dialog: HTMLElement) => within(dialog).getByRole('button', { name: 'Send' });
const fill = (
  dialog: HTMLElement,
  ids: string[] = [USER.rich],
  title = 'Hello',
  body = 'A message',
) => {
  type(recipientsBox(dialog), ids.join('\n'));
  type(titleBox(dialog), title);
  type(bodyBox(dialog), body);
};
const sends = (calls: { method: string; url: string; body?: unknown }[]) =>
  writesOf(calls).filter((c) => c.url === '/api/admin/notifications/send');
const sentBody = (calls: { method: string; url: string; body?: unknown }[]) =>
  sends(calls)[0]?.body as Record<string, unknown>;

describe('the dialog opens and closes', () => {
  it('shows the sentence about all users, the fields and the push text exactly as the task says', async () => {
    useMockBackend({ default: notificationsMock });
    const user = userEvent.setup();
    renderPage(<NotificationsPage />);
    const dialog = await openDialog(user);
    expect(
      within(dialog).getByText(
        'This goes only to the accounts named below. To message all users, use a manual push task in Push management.',
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('Also send a push')).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "The push follows each user's announcement notification preference; a user who has turned it off only gets the inbox message.",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('checkbox', { name: 'Also send a push' })).not.toBeChecked();
  });

  it('is mounted only while open: a second opening shows empty fields, not the ones typed before', async () => {
    useMockBackend({ default: notificationsMock });
    const user = userEvent.setup();
    renderPage(<NotificationsPage />);
    let dialog = await openDialog(user);
    fill(dialog, ['abc', 'def'], 'Typed title', 'Typed body');
    await user.click(within(dialog).getByRole('checkbox', { name: 'Also send a push' }));
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(document.querySelector('.ant-modal')).toBeNull());
    dialog = await openDialog(user);
    expect((recipientsBox(dialog) as HTMLTextAreaElement).value).toBe('');
    expect((titleBox(dialog) as HTMLInputElement).value).toBe('');
    expect((bodyBox(dialog) as HTMLTextAreaElement).value).toBe('');
    expect(within(dialog).getByRole('checkbox', { name: 'Also send a push' })).not.toBeChecked();
  });
});

describe('the recipients: one account id per line', () => {
  it('counts the accounts live, trims lines, drops empty ones and merges repeats, saying how many were merged', async () => {
    useMockBackend({ default: notificationsMock });
    const user = userEvent.setup();
    renderPage(<NotificationsPage />);
    const dialog = await openDialog(user);
    type(recipientsBox(dialog), ` a1 \n\n${IDEOGRAPHIC}b2\r\na1\n  \nc3\nb2`);
    expect(await within(dialog).findByText('3 accounts')).toBeInTheDocument();
    expect(within(dialog).getByText('2 repeated lines were merged')).toBeInTheDocument();
    type(recipientsBox(dialog), 'only');
    expect(await within(dialog).findByText('1 account')).toBeInTheDocument();
    expect(within(dialog).queryByText(/repeated/)).toBeNull();
  });

  it('sends the ids trimmed, once each, in the order written', async () => {
    const calls = useMockBackend({ default: notificationsMock });
    const user = userEvent.setup();
    const [a, b] = ACTIVE();
    renderPage(<NotificationsPage />);
    const dialog = await openDialog(user);
    fill(dialog, [` ${a} `, '', b, a]);
    await user.click(submit(dialog));
    await waitFor(() => expect(sends(calls).length).toBe(1));
    expect(sentBody(calls).accountIds).toEqual([a, b]);
  });

  it('refuses an empty list without sending', async () => {
    const calls = useMockBackend({ default: notificationsMock });
    const user = userEvent.setup();
    renderPage(<NotificationsPage />);
    const dialog = await openDialog(user);
    type(titleBox(dialog), 'T');
    type(bodyBox(dialog), 'B');
    type(recipientsBox(dialog), ' \n \n');
    await user.click(submit(dialog));
    expect(await within(dialog).findByText('Enter at least one account ID')).toBeInTheDocument();
    expect(sends(calls).length).toBe(0);
  });

  it('refuses more than maxRecipients of GET /meta, says how many there are, and sends nothing', async () => {
    signIn('root', { meta: { ...META, maxRecipients: 3 } });
    const calls = useMockBackend({ default: notificationsMock });
    const user = userEvent.setup();
    renderPage(<NotificationsPage />);
    const dialog = await openDialog(user);
    fill(dialog, ['a', 'b', 'c', 'd']);
    await user.click(submit(dialog));
    expect(
      await within(dialog).findByText('At most 3 accounts at a time; there are 4'),
    ).toBeInTheDocument();
    expect(sends(calls).length).toBe(0);
    type(recipientsBox(dialog), 'a\nb\nc\nc\nc');
    await waitFor(() => expect(within(dialog).queryByText(/At most 3 accounts/)).toBeNull());
  });

  it('says the limit of GET /meta in the box, and says nothing about a limit when the meta has none', async () => {
    useMockBackend({ default: notificationsMock });
    const user = userEvent.setup();
    const { unmount } = renderPage(<NotificationsPage />);
    let dialog = await openDialog(user);
    expect(within(dialog).getByText('Limit: 1000 accounts per batch.')).toBeInTheDocument();
    unmount();
    signIn('root', { meta: { ...META, maxRecipients: undefined } });
    useMockBackend({ default: notificationsMock });
    renderPage(<NotificationsPage />);
    dialog = await openDialog(user);
    expect(within(dialog).queryByText(/Limit:/)).toBeNull();
  });

  it('counts the limit on the ids after the repeats are merged', async () => {
    signIn('root', { meta: { ...META, maxRecipients: 2 } });
    const calls = useMockBackend({ default: notificationsMock });
    const [a, b] = ACTIVE();
    const user = userEvent.setup();
    renderPage(<NotificationsPage />);
    const dialog = await openDialog(user);
    fill(dialog, [a, b, a, b, a]);
    await user.click(submit(dialog));
    await waitFor(() => expect(sends(calls).length).toBe(1));
  });

  it.each([
    ['missing', { ...META, maxRecipients: undefined }],
    ['null', { ...META, maxRecipients: null }],
    ['no meta at all', null],
  ])('leaves the limit to the backend when GET /meta has none (%s)', async (_name, meta) => {
    signIn('root', { meta });
    const calls = useMockBackend({ default: notificationsMock });
    const user = userEvent.setup();
    renderPage(<NotificationsPage />);
    const dialog = await openDialog(user);
    fill(
      dialog,
      Array.from({ length: 1500 }, (_, i) => `acc-${i}`),
    );
    await user.click(submit(dialog));
    await waitFor(() => expect(sends(calls).length).toBe(1));
    expect(within(dialog).queryByText(/At most/)).toBeNull();
  });
});

describe('the title and the body', () => {
  it('shows live counters of code points: an emoji is one, Thai and Arabic are counted by letters', async () => {
    useMockBackend({ default: notificationsMock });
    const user = userEvent.setup();
    renderPage(<NotificationsPage />);
    const dialog = await openDialog(user);
    expect(within(dialog).getAllByText('0 / 100').length).toBe(1);
    expect(within(dialog).getAllByText('0 / 500').length).toBe(1);
    type(titleBox(dialog), '😀😀😀');
    expect(await within(dialog).findByText('3 / 100')).toBeInTheDocument();
    type(titleBox(dialog), 'สวัสดี');
    expect(await within(dialog).findByText('6 / 100')).toBeInTheDocument();
    type(bodyBox(dialog), `  مرحبا بك${IDEOGRAPHIC}`);
    expect(await within(dialog).findByText('8 / 500')).toBeInTheDocument();
  });

  it('accepts exactly 100 and 500 code points and sends them', async () => {
    const calls = useMockBackend({ default: notificationsMock });
    const user = userEvent.setup();
    renderPage(<NotificationsPage />);
    const dialog = await openDialog(user);
    fill(dialog, [USER.rich], '😀'.repeat(100), '😀'.repeat(500));
    await user.click(submit(dialog));
    await waitFor(() => expect(sends(calls).length).toBe(1));
    expect(sentBody(calls).titleI18n).toEqual({ en: '😀'.repeat(100) });
  });

  it('marks 101 and 501 at once, in red with the numbers, and does not send', async () => {
    const calls = useMockBackend({ default: notificationsMock });
    const user = userEvent.setup();
    renderPage(<NotificationsPage />);
    const dialog = await openDialog(user);
    fill(dialog, [USER.rich], '😀'.repeat(101), 'ก'.repeat(501));
    expect(
      await within(dialog).findByText('The title has at most 100 characters; it has 101'),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText('The body has at most 500 characters; it has 501'),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('101 / 100').className).toMatch(/danger/);
    await user.click(submit(dialog));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(sends(calls).length).toBe(0);
  });

  it('does not count the whitespace at either end (the contract definition, not String.trim)', async () => {
    const calls = useMockBackend({ default: notificationsMock });
    const user = userEvent.setup();
    renderPage(<NotificationsPage />);
    const dialog = await openDialog(user);
    fill(dialog, [USER.rich], ` ${'x'.repeat(100)}${IDEOGRAPHIC}`, `\n${'y'.repeat(500)} `);
    expect(await within(dialog).findByText('100 / 100')).toBeInTheDocument();
    await user.click(submit(dialog));
    await waitFor(() => expect(sends(calls).length).toBe(1));
    expect(sentBody(calls).titleI18n).toEqual({ en: 'x'.repeat(100) });
    expect(sentBody(calls).bodyI18n).toEqual({ en: 'y'.repeat(500) });
  });

  it('requires English: an empty English title or body is refused and nothing is sent', async () => {
    const calls = useMockBackend({ default: notificationsMock });
    const user = userEvent.setup();
    renderPage(<NotificationsPage />);
    const dialog = await openDialog(user);
    type(recipientsBox(dialog), USER.rich);
    type(titleBox(dialog), `${IDEOGRAPHIC} `);
    await user.click(submit(dialog));
    expect((await within(dialog).findAllByText('It must not be empty.')).length).toBe(2);
    expect(sends(calls).length).toBe(0);
    expect(within(dialog).queryByRole('button', { name: 'Remove en' })).toBeNull();
  });

  it('shows English as required on its tab', async () => {
    useMockBackend({ default: notificationsMock });
    const user = userEvent.setup();
    renderPage(<NotificationsPage />);
    const dialog = await openDialog(user);
    expect(within(dialog).getByRole('tab', { name: 'en (required)' })).toBeInTheDocument();
  });
});

describe('the languages', () => {
  const addLanguage = async (
    user: ReturnType<typeof userEvent.setup>,
    dialog: HTMLElement,
    tag: string,
  ) => {
    const box = within(dialog).getByRole('combobox', {
      name: 'Language tag, for example th or zh-Hans',
    });
    await user.click(box);
    await user.clear(box);
    await user.type(box, tag);
    await user.click(within(dialog).getByRole('button', { name: 'Add language' }));
  };

  it('adds a language with its own title and body, and sends every language', async () => {
    const calls = useMockBackend({ default: notificationsMock });
    const user = userEvent.setup();
    renderPage(<NotificationsPage />);
    const dialog = await openDialog(user);
    fill(dialog, [USER.rich], 'Hello', 'A message');
    await addLanguage(user, dialog, 'th');
    expect(await within(dialog).findByRole('tab', { name: 'th' })).toBeInTheDocument();
    type(titleBox(dialog, 'th'), 'สวัสดี 😀');
    type(bodyBox(dialog, 'th'), 'ข้อความ');
    await addLanguage(user, dialog, 'ar');
    type(titleBox(dialog, 'ar'), 'مرحبا');
    type(bodyBox(dialog, 'ar'), 'رسالة');
    await user.click(submit(dialog));
    await waitFor(() => expect(sends(calls).length).toBe(1));
    expect(sentBody(calls).titleI18n).toEqual({ en: 'Hello', th: 'สวัสดี 😀', ar: 'مرحبا' });
    expect(sentBody(calls).bodyI18n).toEqual({ en: 'A message', th: 'ข้อความ', ar: 'رسالة' });
  });

  it('suggests the languages of GET /meta that are not added yet', async () => {
    useMockBackend({ default: notificationsMock });
    const user = userEvent.setup();
    renderPage(<NotificationsPage />);
    const dialog = await openDialog(user);
    await user.click(
      within(dialog).getByRole('combobox', { name: 'Language tag, for example th or zh-Hans' }),
    );
    const options = [...document.querySelectorAll('.ant-select-item-option-content')].map(
      (n) => n.textContent,
    );
    expect(options).toEqual(['th', 'ar']);
  });

  it('refuses a tag that is not valid and one that is there already, with the reason', async () => {
    useMockBackend({ default: notificationsMock });
    const user = userEvent.setup();
    renderPage(<NotificationsPage />);
    const dialog = await openDialog(user);
    await addLanguage(user, dialog, 'english');
    expect(
      await within(dialog).findByText(
        'Not a valid language tag (for example th or zh-Hans, at most 35 characters)',
      ),
    ).toBeInTheDocument();
    await addLanguage(user, dialog, 'EN');
    expect(await within(dialog).findByText('This language is already added')).toBeInTheDocument();
    expect(within(dialog).getAllByRole('tab').length).toBe(1);
  });

  it('blocks the whole send when one language fails: a language left empty, with the reason on its tab', async () => {
    const calls = useMockBackend({ default: notificationsMock });
    const user = userEvent.setup();
    renderPage(<NotificationsPage />);
    const dialog = await openDialog(user);
    fill(dialog);
    await addLanguage(user, dialog, 'th');
    type(titleBox(dialog, 'th'), 'only a title');
    await user.click(within(dialog).getByRole('tab', { name: 'en (required)' }));
    await user.click(submit(dialog));
    const bad = await within(dialog).findByRole('tab', { name: /th.*has an error/ });
    expect(bad).toBeInTheDocument();
    expect(sends(calls).length).toBe(0);
    expect(within(dialog).getByText('It must not be empty.')).toBeInTheDocument();
    expect(within(dialog).getByRole('textbox', { name: 'Body (th)' })).toBeInTheDocument();
  });

  it('blocks the whole send when one language is too long', async () => {
    const calls = useMockBackend({ default: notificationsMock });
    const user = userEvent.setup();
    renderPage(<NotificationsPage />);
    const dialog = await openDialog(user);
    fill(dialog);
    await addLanguage(user, dialog, 'ar');
    type(titleBox(dialog, 'ar'), 'ب'.repeat(101));
    type(bodyBox(dialog, 'ar'), 'x');
    await user.click(within(dialog).getByRole('tab', { name: 'en (required)' }));
    await user.click(submit(dialog));
    expect(
      await within(dialog).findByRole('tab', { name: /ar.*has an error/ }),
    ).toBeInTheDocument();
    expect(sends(calls).length).toBe(0);
  });

  it('removes a language again, and English cannot be removed', async () => {
    const calls = useMockBackend({ default: notificationsMock });
    const user = userEvent.setup();
    renderPage(<NotificationsPage />);
    const dialog = await openDialog(user);
    fill(dialog);
    await addLanguage(user, dialog, 'th');
    await user.click(await within(dialog).findByRole('button', { name: 'Remove th' }));
    await waitFor(() => expect(within(dialog).queryByRole('tab', { name: 'th' })).toBeNull());
    await user.click(submit(dialog));
    await waitFor(() => expect(sends(calls).length).toBe(1));
    expect(sentBody(calls).titleI18n).toEqual({ en: 'Hello' });
  });
});

describe('the link', () => {
  const linkBox = (dialog: HTMLElement) => within(within(dialog).getByTestId('link-field'));
  const chooseLinkKind = async (
    user: ReturnType<typeof userEvent.setup>,
    dialog: HTMLElement,
    text: string,
  ) => {
    await user.click(linkBox(dialog).getAllByRole('combobox')[0]);
    const options = await screen.findAllByText(text, {
      selector: '.ant-select-item-option-content',
    });
    await user.click(options[options.length - 1]);
  };
  const chooseScreen = async (
    user: ReturnType<typeof userEvent.setup>,
    dialog: HTMLElement,
    text: string,
  ) => {
    await user.click(linkBox(dialog).getAllByRole('combobox')[1]);
    const options = await screen.findAllByText(text, {
      selector: '.ant-select-item-option-content',
    });
    await user.click(options[options.length - 1]);
  };

  it('offers nothing, a screen of the app or a web address; the screens are the shared list', async () => {
    useMockBackend({ default: notificationsMock });
    const user = userEvent.setup();
    renderPage(<NotificationsPage />);
    const dialog = await openDialog(user);
    await user.click(linkBox(dialog).getAllByRole('combobox')[0]);
    const kinds = [...document.querySelectorAll('.ant-select-item-option-content')].map(
      (n) => n.textContent,
    );
    expect(kinds).toEqual(['No link', 'App screen', 'Web address']);
    await user.click(
      (
        await screen.findAllByText('App screen', { selector: '.ant-select-item-option-content' })
      ).at(-1) as HTMLElement,
    );
    await user.click(linkBox(dialog).getAllByRole('combobox')[1]);
    const screens = [...document.querySelectorAll('.ant-select-item-option-content')]
      .map((n) => n.textContent)
      .filter((text) => text !== 'No link' && text !== 'App screen' && text !== 'Web address');
    expect(screens).toEqual(SCREEN_TARGETS.map((id) => enUS[`pages.link.screen.${id}`]));
  });

  it('sends no link fields without a link', async () => {
    const calls = useMockBackend({ default: notificationsMock });
    const user = userEvent.setup();
    renderPage(<NotificationsPage />);
    const dialog = await openDialog(user);
    fill(dialog);
    await user.click(submit(dialog));
    await waitFor(() => expect(sends(calls).length).toBe(1));
    expect(Object.keys(sentBody(calls)).sort()).toEqual([
      'accountIds',
      'bodyI18n',
      'push',
      'titleI18n',
    ]);
  });

  it('refuses a screen that was not chosen and sends nothing', async () => {
    const calls = useMockBackend({ default: notificationsMock });
    const user = userEvent.setup();
    renderPage(<NotificationsPage />);
    const dialog = await openDialog(user);
    fill(dialog);
    await chooseLinkKind(user, dialog, 'App screen');
    await user.click(submit(dialog));
    expect(
      await within(dialog).findByText('Choose a screen', {
        selector: '.ant-form-item-explain-error',
      }),
    ).toBeInTheDocument();
    expect(sends(calls).length).toBe(0);
  });

  it('sends the chosen screen', async () => {
    const calls = useMockBackend({ default: notificationsMock });
    const user = userEvent.setup();
    renderPage(<NotificationsPage />);
    const dialog = await openDialog(user);
    fill(dialog);
    await chooseLinkKind(user, dialog, 'App screen');
    await chooseScreen(user, dialog, 'Store');
    await user.click(submit(dialog));
    await waitFor(() => expect(sends(calls).length).toBe(1));
    expect(sentBody(calls)).toMatchObject({ linkType: 'SCREEN', linkTarget: 'store' });
  });

  it('refuses an empty address and http://, accepts https://, and sends the address', async () => {
    const calls = useMockBackend({ default: notificationsMock });
    const user = userEvent.setup();
    renderPage(<NotificationsPage />);
    const dialog = await openDialog(user);
    fill(dialog);
    await chooseLinkKind(user, dialog, 'Web address');
    await user.click(submit(dialog));
    expect(
      await within(dialog).findAllByText('The link must start with lowercase https://.'),
    ).not.toHaveLength(0);
    expect(sends(calls).length).toBe(0);
    const input = linkBox(dialog).getByPlaceholderText('https://…');
    type(input, 'http://example.com/a');
    await user.click(submit(dialog));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(sends(calls).length).toBe(0);
    type(input, 'https://example.com/a?x=1');
    await user.click(submit(dialog));
    await waitFor(() => expect(sends(calls).length).toBe(1));
    expect(sentBody(calls)).toMatchObject({
      linkType: 'URL',
      linkTarget: 'https://example.com/a?x=1',
    });
  });
});

describe('the push choice', () => {
  it('sends push=true only when the box is ticked', async () => {
    const calls = useMockBackend({ default: notificationsMock });
    const user = userEvent.setup();
    renderPage(<NotificationsPage />);
    const dialog = await openDialog(user);
    fill(dialog);
    await user.click(within(dialog).getByRole('checkbox', { name: 'Also send a push' }));
    await user.click(submit(dialog));
    await waitFor(() => expect(sends(calls).length).toBe(1));
    expect(sentBody(calls).push).toBe(true);
  });

  it('sends push=false when it is not', async () => {
    const calls = useMockBackend({ default: notificationsMock });
    const user = userEvent.setup();
    renderPage(<NotificationsPage />);
    const dialog = await openDialog(user);
    fill(dialog);
    await user.click(submit(dialog));
    await waitFor(() => expect(sends(calls).length).toBe(1));
    expect(sentBody(calls).push).toBe(false);
  });
});

describe('sending', () => {
  it('sends once, says how many were written, closes, and the list shows them', async () => {
    const calls = useMockBackend({ default: notificationsMock });
    const user = userEvent.setup();
    const ids = ACTIVE().slice(0, 3);
    const before = notificationsState.rows.length;
    renderPage(<NotificationsPage />);
    const dialog = await openDialog(user);
    fill(dialog, ids, 'Brand new title', 'Body of it');
    await user.click(submit(dialog));
    expect(await screen.findByText('Sent 3 notifications')).toBeInTheDocument();
    expect(notificationsState.rows.length).toBe(before + 3);
    await waitFor(() =>
      expect(document.querySelector('.ant-modal-wrap')?.className ?? 'ant-modal-hidden').toMatch(
        /hidden|leave/,
      ),
    );
    expect((await screen.findAllByText('Brand new title')).length).toBeGreaterThan(0);
    expect(sends(calls).length).toBe(1);
  });

  it('sends one request when the button is pressed twice', async () => {
    const calls = useMockBackend({ default: notificationsMock });
    const real = globalThis.fetch;
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL, init: RequestInit = {}) => {
        if ((init.method ?? 'GET').toUpperCase() === 'POST') await gate;
        return real(input, init);
      }),
    );
    const user = userEvent.setup();
    renderPage(<NotificationsPage />);
    const dialog = await openDialog(user);
    fill(dialog);
    const button = submit(dialog);
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);
    release();
    await screen.findByText('Sent 1 notification');
    expect(sends(calls).length).toBe(1);
  });

  it('lists each bad account with its reason, says nothing was sent, and keeps what was typed', async () => {
    const calls = useMockBackend({ default: notificationsMock });
    const user = userEvent.setup();
    const before = notificationsState.rows.length;
    renderPage(<NotificationsPage />);
    const dialog = await openDialog(user);
    fill(dialog, [USER.rich, 'ghost-1', USER.banned, 'ghost-2'], 'Keep me', 'And me');
    await user.click(submit(dialog));
    expect(
      await within(dialog).findByText(
        'These accounts cannot receive a message; fix them and send again:',
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText('Account ghost-1: The account does not exist.'),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText('Account ghost-2: The account does not exist.'),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(`Account ${USER.banned}: The account is not active.`),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText('This batch was not sent: not one notification was written.'),
    ).toBeInTheDocument();
    expect(notificationsState.rows.length).toBe(before);
    expect((titleBox(dialog) as HTMLInputElement).value).toBe('Keep me');
    expect((recipientsBox(dialog) as HTMLTextAreaElement).value).toContain('ghost-1');
    expect(sends(calls).length).toBe(1);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('shows only the translated text of a known error code, never the backend words', async () => {
    stubFetch(async ({ url }) =>
      new URL(url, 'http://x').pathname.endsWith('/send')
        ? jsonResponse(
            400,
            envelope(
              'INVALID_REQUEST',
              { details: [{ ref: 'a1', reason: 'ACCOUNT_NOT_FOUND' }] },
              'SECRET backend sentence',
            ),
          )
        : jsonResponse(200, envelope('200', { items: [], total: 0 })),
    );
    const user = userEvent.setup();
    renderPage(<NotificationsPage />);
    const dialog = await openDialog(user);
    fill(dialog, ['a1']);
    await user.click(submit(dialog));
    await within(dialog).findByText('Account a1: The account does not exist.');
    expect(document.body.textContent).not.toContain('SECRET backend sentence');
  });

  it('puts a refused text of a language under its field and on its tab', async () => {
    stubFetch(async ({ url }) =>
      new URL(url, 'http://x').pathname.endsWith('/send')
        ? jsonResponse(
            400,
            envelope('INVALID_REQUEST', { details: [{ ref: 'titleI18n.en', reason: 'TOO_LONG' }] }),
          )
        : jsonResponse(200, envelope('200', { items: [], total: 0 })),
    );
    const user = userEvent.setup();
    renderPage(<NotificationsPage />);
    const dialog = await openDialog(user);
    fill(dialog);
    await user.click(submit(dialog));
    expect(await within(dialog).findByText('The value is too long.')).toBeInTheDocument();
    expect(within(dialog).getByText('Title: The value is too long.')).toBeInTheDocument();
  });

  it('names a field that is not an account by its label', async () => {
    stubFetch(async ({ url }) =>
      new URL(url, 'http://x').pathname.endsWith('/send')
        ? jsonResponse(
            400,
            envelope('INVALID_REQUEST', {
              details: [
                { ref: 'linkTarget', reason: 'NOT_HTTPS' },
                { ref: 'weird-ref', reason: 'SOMETHING_NEW' },
              ],
            }),
          )
        : jsonResponse(200, envelope('200', { items: [], total: 0 })),
    );
    const user = userEvent.setup();
    renderPage(<NotificationsPage />);
    const dialog = await openDialog(user);
    fill(dialog);
    await user.click(submit(dialog));
    expect(
      await within(dialog).findByText('Link target: The link must start with lowercase https://.'),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        'weird-ref: Some input is not valid. Please check the fields and try again.',
      ),
    ).toBeInTheDocument();
  });

  it('when no answer came back it says it is not known whether the batch went out, and does not say it was not sent', async () => {
    stubFetch(async ({ url }) => {
      if (new URL(url, 'http://x').pathname.endsWith('/send')) throw new TypeError('network down');
      return jsonResponse(200, envelope('200', { items: [], total: 0 }));
    });
    const user = userEvent.setup();
    renderPage(<NotificationsPage />);
    const dialog = await openDialog(user);
    fill(dialog);
    await user.click(submit(dialog));
    expect(
      await within(dialog).findByText(/it is not known whether this batch was sent/),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByText('This batch was not sent: not one notification was written.'),
    ).toBeNull();
  });

  it('shows the words of another refusal (no permission) and keeps the dialog', async () => {
    stubFetch(async ({ url }) =>
      new URL(url, 'http://x').pathname.endsWith('/send')
        ? jsonResponse(403, envelope('ADMIN_FORBIDDEN'))
        : jsonResponse(200, envelope('200', { items: [], total: 0 })),
    );
    const user = userEvent.setup();
    renderPage(<NotificationsPage />);
    const dialog = await openDialog(user);
    fill(dialog);
    await user.click(submit(dialog));
    await waitFor(() => expect(within(dialog).getByRole('alert')).toBeInTheDocument());
    expect(within(dialog).queryByText(/not sent: not one/)).toBeNull();
  });

  it('can be sent again after a failure with the fields as they were', async () => {
    const calls = useMockBackend({ default: notificationsMock });
    const user = userEvent.setup();
    renderPage(<NotificationsPage />);
    const dialog = await openDialog(user);
    fill(dialog, ['ghost-1']);
    await user.click(submit(dialog));
    await within(dialog).findByText('Account ghost-1: The account does not exist.');
    type(recipientsBox(dialog), USER.rich);
    await user.click(submit(dialog));
    await screen.findByText('Sent 1 notification');
    expect(sends(calls).length).toBe(2);
  });
});
