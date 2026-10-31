import { configure, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { saved } from '../../../mock/_core/configStore';
import configMock from '../../../mock/config.mock';
import smsMock from '../../../mock/sms.mock';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import TemplatesPage from './templates';
import {
  chooseOption,
  dialogsClosed,
  holdWrites,
  jsonAnswer,
  overrideFetch,
  settled,
  signIn,
  smsState,
  writesOf,
} from './testSetup';

// A page test fills and presses a lot; under a full run with many files in parallel the default 5 seconds is not enough.
vi.setConfig({ testTimeout: 30000 });

const backend = () => useMockBackend({ default: smsMock }, { default: configMock });

beforeEach(() => {
  signIn('root');
  // Under a full parallel run one second is not enough for what a click sets going (a read of the settings, a request, a list read again).
  configure({ asyncUtilTimeout: 6000 });
});
afterEach(() => {
  configure({ asyncUtilTimeout: 1000 });
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const rows = () => [...document.querySelectorAll('.ant-table-tbody tr.ant-table-row')];
const cellsOf = (tr: Element) => [...tr.querySelectorAll('td')].map((td) => td.textContent ?? '');
const template = (code: string) => {
  const found = [...smsState.templates.values()].find((t) => t.templateCode === code);
  if (!found) throw new Error(`no template ${code}`);
  return found;
};
const rowOf = async (code: string) => {
  await waitFor(() => expect(rows().some((tr) => cellsOf(tr)[0] === code)).toBe(true));
  return rows().find((tr) => cellsOf(tr)[0] === code) as HTMLTableRowElement;
};
const load = async () => {
  const calls = backend();
  const user = userEvent.setup();
  renderPage(<TemplatesPage />);
  await waitFor(() => expect(rows().length).toBeGreaterThan(0));
  return { calls, user };
};
const switchOf = (code: string) => screen.getByRole('switch', { name: `Enabled: ${code}` });
const dialog = () => screen.findByRole('dialog');
const openNew = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'New template' }));
  return within(await dialog());
};
const openEdit = async (user: ReturnType<typeof userEvent.setup>, code: string) => {
  await user.click(within(await rowOf(code)).getByRole('button', { name: 'Edit' }));
  return within(await dialog());
};
const setText = (input: HTMLElement, value: string) =>
  fireEvent.change(input, { target: { value } });
const only = (code: string) => {
  for (const t of smsState.templates.values()) if (t.templateCode !== code) t.enabled = false;
};

async function fillNew(
  user: ReturnType<typeof userEvent.setup>,
  form: ReturnType<typeof within>,
  over: Partial<Record<'code' | 'name' | 'locale' | 'content' | 'type', string>> = {},
) {
  await user.type(form.getByRole('textbox', { name: 'Template code' }), over.code ?? 'otp_new');
  await user.type(form.getByRole('textbox', { name: 'Name' }), over.name ?? 'New template');
  await chooseOption(user, 'Type', over.type ?? 'OTP', await dialog());
  await user.type(form.getByRole('textbox', { name: 'Language' }), over.locale ?? 'en');
  setText(form.getByRole('textbox', { name: 'Content' }), over.content ?? 'Your code is {code}');
}

describe('the list of templates', () => {
  it('shows the columns of the spec and the rule that chooses a template', async () => {
    await load();
    expect(
      [...document.querySelectorAll('.ant-table-thead th')].map((th) => th.textContent),
    ).toEqual([
      'Code',
      'Name',
      'Type',
      'Language',
      'Country',
      'Content',
      'Provider template ID',
      'Enabled',
      'Actions',
    ]);
    const th = cellsOf(await rowOf('otp_th'));
    expect(th.slice(0, 7)).toEqual([
      'otp_th',
      'ไทย',
      'OTP',
      'th',
      'TH',
      template('otp_th').content,
      'TPL-TH-1',
    ]);
    expect(cellsOf(await rowOf('promo_en'))[2]).toBe('Marketing');
    expect(cellsOf(await rowOf('otp_en'))[4]).toBe('—');
    expect(cellsOf(await rowOf('otp_en'))[6]).toBe('—');
    expect(switchOf('otp_en')).toBeChecked();
    expect(switchOf('promo_en')).not.toBeChecked();
    expect(
      screen.getByText(
        /language of the user.*Accept-Language.*same language for any country.*English.*the send fails/s,
      ),
    ).toBeInTheDocument();
  });

  it('shows contents in every language and lets a content of 5000 letters without a space break anywhere', async () => {
    await load();
    for (const code of ['otp_th', 'otp_ar', 'otp_id', 'otp_vi', 'otp_es', 'otp_zh', 'otp_en']) {
      expect(screen.getByText(template(code).content)).toBeInTheDocument();
    }
    const long = screen.getByText(template('otp_long').content);
    expect((long.closest('button') as HTMLElement).style.overflowWrap).toBe('anywhere');
  });

  it('draws what it is given even when the values are not what the contract says', async () => {
    backend();
    overrideFetch(async ({ url, method }) =>
      method === 'GET' && url.pathname === '/api/admin/sms/templates'
        ? jsonAnswer(200, '200', {
            items: [
              {
                id: 3,
                templateCode: { x: 1 },
                name: ['a'],
                smsType: 'OTP',
                content: 42,
                enabled: 'yes',
              },
              null,
            ],
            total: 2,
          })
        : undefined,
    );
    renderPage(<TemplatesPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    expect(document.body.textContent).toContain('"x":1');
  });

  it('says what went wrong in the words of the code, with a button to read again', async () => {
    backend();
    let fail = true;
    overrideFetch(async ({ url, method }) =>
      fail && method === 'GET' && url.pathname === '/api/admin/sms/templates'
        ? jsonAnswer(500, 'INTERNAL_ERROR', null, 'SECRET BACKEND WORDS')
        : undefined,
    );
    const user = userEvent.setup();
    renderPage(<TemplatesPage />);
    expect(await screen.findByText(/Failed to load/)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('SECRET BACKEND WORDS');
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
  });
});

describe('the content of an OTP template', () => {
  it('lists the placeholders that can be used', async () => {
    const { user } = await load();
    const form = await openNew(user);
    expect(form.getByText(/\{code\}.*\{minutes\}.*\{appName\}/s)).toBeInTheDocument();
  });

  it('gets an error as it is typed when {code} is not there, naming {code}, and cannot be saved', async () => {
    const { calls, user } = await load();
    const form = await openNew(user);
    await fillNew(user, form, { content: 'Your code is code' });
    expect(await form.findByText(/The content is missing \{code\}/)).toBeInTheDocument();
    await user.click(form.getByRole('button', { name: 'Submit' }));
    await settled();
    expect(writesOf(calls)).toHaveLength(0);
  });

  it.each([
    ['the bare word', 'Your code is code'],
    ['capitals', 'Your code is {CODE}'],
    ['spaces inside the braces', 'Your code is { code }'],
    ['a capital first letter', 'Your code is {Code}'],
    ['one brace', 'Your code is {code'],
    ['nothing', ''],
  ])('does not accept %s as {code}', async (_name, content) => {
    const { user } = await load();
    const form = await openNew(user);
    await fillNew(user, form, { content: 'x' });
    setText(form.getByRole('textbox', { name: 'Content' }), content);
    expect(await form.findByText(/The content is missing \{code\}/)).toBeInTheDocument();
  });

  it('loses the error when {code} is written, and when the type is not OTP', async () => {
    const { calls, user } = await load();
    const form = await openNew(user);
    await fillNew(user, form, { content: 'no placeholder' });
    expect(await form.findByText(/The content is missing \{code\}/)).toBeInTheDocument();
    setText(form.getByRole('textbox', { name: 'Content' }), 'Code {code} for {appName}');
    await waitFor(() => expect(form.queryByText(/The content is missing/)).toBeNull());
    setText(form.getByRole('textbox', { name: 'Content' }), 'no placeholder again');
    expect(await form.findByText(/The content is missing/)).toBeInTheDocument();
    await chooseOption(user, 'Type', 'Marketing', await dialog());
    await waitFor(() => expect(form.queryByText(/The content is missing/)).toBeNull());
    await user.click(form.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0].body).toMatchObject({
      smsType: 'MARKETING',
      content: 'no placeholder again',
    });
  });
});

describe('creating and editing a template', () => {
  it('creates a template with the values as they are written and shows it in the list', async () => {
    const { calls, user } = await load();
    const form = await openNew(user);
    await fillNew(user, form, { content: 'รหัสของคุณคือ {code}', locale: 'th' });
    await user.type(form.getByRole('textbox', { name: 'Country' }), 'th');
    await user.type(form.getByRole('textbox', { name: 'Provider template ID' }), 'TPL-9');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0]).toMatchObject({
      method: 'POST',
      url: '/api/admin/sms/templates',
      body: {
        templateCode: 'otp_new',
        name: 'New template',
        smsType: 'OTP',
        locale: 'th',
        country: 'TH',
        content: 'รหัสของคุณคือ {code}',
        providerTemplateId: 'TPL-9',
        enabled: false,
      },
    });
    expect(await rowOf('otp_new')).toBeTruthy();
  });

  it('checks the code, the name, the type, the language and the content before it sends anything', async () => {
    const { calls, user } = await load();
    const form = await openNew(user);
    await user.click(form.getByRole('button', { name: 'Submit' }));
    expect(await form.findByText('Enter the template code')).toBeInTheDocument();
    expect(form.getByText('Enter the name')).toBeInTheDocument();
    expect(form.getByText('Choose a type')).toBeInTheDocument();
    expect(form.getByText('Enter the language')).toBeInTheDocument();
    expect(form.getByText('Enter the content')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('refuses a country that is not two letters', async () => {
    const { calls, user } = await load();
    const form = await openNew(user);
    await fillNew(user, form);
    await user.type(form.getByRole('textbox', { name: 'Country' }), 'THA');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    expect(await form.findByText(/Country codes are two letters/)).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('refuses a code that another template already has, before anything is sent', async () => {
    const { calls, user } = await load();
    const form = await openNew(user);
    await fillNew(user, form, { code: 'otp_en' });
    await user.click(form.getByRole('button', { name: 'Submit' }));
    expect(await form.findByText('A template with this code already exists')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('shows the words of the code when the backend says the code is taken', async () => {
    backend();
    overrideFetch(async ({ method }) =>
      method === 'POST'
        ? jsonAnswer(409, 'DUPLICATE_RESOURCE', { field: 'templateCode' }, 'SECRET BACKEND WORDS')
        : undefined,
    );
    const user = userEvent.setup();
    renderPage(<TemplatesPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    const form = await openNew(user);
    await fillNew(user, form);
    await user.click(form.getByRole('button', { name: 'Submit' }));
    expect(
      await form.findByText('An item with the same unique value already exists.'),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('SECRET BACKEND WORDS');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('puts the reason of the backend under the field it names, in the words of the reason', async () => {
    backend();
    overrideFetch(async ({ method }) =>
      method === 'POST'
        ? jsonAnswer(
            400,
            'INVALID_REQUEST',
            { details: [{ ref: 'locale', reason: 'INVALID_LANGUAGE_TAG' }] },
            'SECRET BACKEND WORDS',
          )
        : undefined,
    );
    const user = userEvent.setup();
    renderPage(<TemplatesPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    const form = await openNew(user);
    await fillNew(user, form);
    await user.click(form.getByRole('button', { name: 'Submit' }));
    expect(await form.findByText('The language tag is not valid.')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('SECRET BACKEND WORDS');
  });

  it('shows the code as text that cannot be edited, fills the form, and sends neither the code nor the switch, when a template is edited', async () => {
    const { calls, user } = await load();
    const form = await openEdit(user, 'otp_th');
    expect(form.queryByRole('textbox', { name: 'Template code' })).toBeNull();
    expect(form.getByText('otp_th')).toBeInTheDocument();
    expect(form.queryByRole('switch', { name: 'Enabled' })).toBeNull();
    expect(form.getByRole('textbox', { name: 'Content' })).toHaveValue(template('otp_th').content);
    expect(form.getByRole('textbox', { name: 'Language' })).toHaveValue('th');
    expect(form.getByRole('textbox', { name: 'Country' })).toHaveValue('TH');
    expect(form.getByRole('textbox', { name: 'Provider template ID' })).toHaveValue('TPL-TH-1');
    setText(form.getByRole('textbox', { name: 'Name' }), 'ไทย (แก้ไข)');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    const body = writesOf(calls)[0].body as Record<string, unknown>;
    expect(writesOf(calls)[0]).toMatchObject({
      method: 'PUT',
      url: `/api/admin/sms/templates/${template('otp_th').id}`,
    });
    expect(Object.keys(body).sort()).toEqual(
      ['content', 'country', 'locale', 'name', 'providerTemplateId', 'smsType'].sort(),
    );
    expect(template('otp_th').name).toBe('ไทย (แก้ไข)');
  });

  it('sends one request when Submit is pressed twice', async () => {
    const { calls, user } = await load();
    const form = await openNew(user);
    await fillNew(user, form);
    const gate = holdWrites();
    const submit = form.getByRole('button', { name: 'Submit' });
    fireEvent.click(submit);
    fireEvent.click(submit);
    await settled();
    expect(gate.started()).toBe(1);
    gate.release();
    await settled();
    expect(writesOf(calls)).toHaveLength(1);
  });

  it('shows that the session has ended and does not send the write again', async () => {
    backend();
    const taken = overrideFetch(async ({ method }) =>
      method === 'POST'
        ? jsonAnswer(401, 'ADMIN_INVALID_TOKEN', null, 'SECRET BACKEND WORDS')
        : undefined,
    );
    const user = userEvent.setup();
    renderPage(<TemplatesPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    const form = await openNew(user);
    await fillNew(user, form);
    await user.click(form.getByRole('button', { name: 'Submit' }));
    expect(
      await screen.findByText('Your session has expired. Please sign in again.'),
    ).toBeInTheDocument();
    await settled();
    expect(taken).toHaveLength(1);
  });

  it('shows what is edited, not what was typed in a dialog that was closed before', async () => {
    const { user } = await load();
    let form = await openNew(user);
    await user.type(form.getByRole('textbox', { name: 'Name' }), 'Typed and abandoned');
    await user.click(form.getByRole('button', { name: 'Cancel' }));
    await dialogsClosed();
    form = await openEdit(user, 'otp_ar');
    expect(form.getByRole('textbox', { name: 'Name' })).toHaveValue(template('otp_ar').name);
    await user.click(form.getByRole('button', { name: 'Cancel' }));
    await dialogsClosed();
    form = await openNew(user);
    expect(form.getByRole('textbox', { name: 'Name' })).toHaveValue('');
    expect(form.getByRole('textbox', { name: 'Content' })).toHaveValue('');
  });
});

describe('the switch of a template', () => {
  it('turns a template on at once with one request', async () => {
    const { calls } = await load();
    await rowOf('promo_en');
    const gate = holdWrites();
    const toggle = switchOf('promo_en');
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    await settled();
    expect(gate.started()).toBe(1);
    gate.release();
    await waitFor(() => expect(switchOf('promo_en')).toBeChecked());
    expect(writesOf(calls)).toEqual([
      expect.objectContaining({
        method: 'PUT',
        url: `/api/admin/sms/templates/${template('promo_en').id}/enabled`,
        body: { enabled: true },
      }),
    ]);
  });

  it('switches off a template without a question when another enabled OTP template exists', async () => {
    const { calls, user } = await load();
    await rowOf('otp_th');
    await user.click(switchOf('otp_th'));
    await waitFor(() => expect(switchOf('otp_th')).not.toBeChecked());
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(writesOf(calls)).toHaveLength(1);
  });

  it('asks first when it is the last enabled English OTP template for every country, sends nothing when declined, and leaves the decision to the backend when confirmed', async () => {
    const { calls, user } = await load();
    await rowOf('otp_en');
    await user.click(switchOf('otp_en'));
    const ask = await screen.findByRole('dialog');
    expect(
      within(ask).getAllByText('This is the last enabled OTP template in English for every country')
        .length,
    ).toBeGreaterThan(0);
    expect(
      within(ask).getByText(/Phone sign-in is off \(auth\.phone_login_enabled\)/),
    ).toBeInTheDocument();
    await user.click(within(ask).getByRole('button', { name: 'Cancel' }));
    await settled();
    expect(writesOf(calls)).toHaveLength(0);
    expect(switchOf('otp_en')).toBeChecked();
    await user.click(switchOf('otp_en'));
    await user.click(
      (await screen.findAllByRole('button', { name: 'Continue' })).at(-1) as HTMLElement,
    );
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(
      await screen.findByText(/an enabled OTP template in English \(en\) for every country/),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('The last enabled OTP template in language en');
    await waitFor(() => expect(switchOf('otp_en')).toBeChecked());
    expect(template('otp_en').enabled).toBe(true);
  });

  it('does not ask when another template (EN, any case) is the English one for every country', async () => {
    smsState.templates.set('90', {
      ...template('otp_en'),
      id: '90',
      templateCode: 'otp_EN',
      locale: 'EN',
    });
    const { calls, user } = await load();
    await rowOf('otp_en');
    await user.click(switchOf('otp_en'));
    await waitFor(() => expect(switchOf('otp_en')).not.toBeChecked());
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(writesOf(calls)).toHaveLength(1);
  });

  it('asks again for the English one when the other English templates have a country or another tag', async () => {
    smsState.templates.set('90', {
      ...template('otp_en'),
      id: '90',
      templateCode: 'otp_gb',
      locale: 'en-GB',
    });
    smsState.templates.set('91', {
      ...template('otp_en'),
      id: '91',
      templateCode: 'otp_enth',
      country: 'TH',
    });
    const { user } = await load();
    await rowOf('otp_en');
    await user.click(switchOf('otp_en'));
    expect(
      (
        await screen.findAllByText(
          'This is the last enabled OTP template in English for every country',
        )
      ).length,
    ).toBeGreaterThan(0);
  });

  it('asks first when it is the last enabled OTP template, names both conditions, and sends nothing when declined', async () => {
    only('otp_en');
    const { calls, user } = await load();
    await rowOf('otp_en');
    await user.click(switchOf('otp_en'));
    const ask = await screen.findByRole('dialog');
    expect(
      within(ask).getAllByText('This is the last enabled OTP template').length,
    ).toBeGreaterThan(0);
    expect(
      within(ask).getByText(/Phone sign-in is off \(auth\.phone_login_enabled\)/),
    ).toBeInTheDocument();
    expect(within(ask).getByText(/accounts that sign in with a phone number/)).toBeInTheDocument();
    await user.click(within(ask).getByRole('button', { name: 'Cancel' }));
    await settled();
    expect(writesOf(calls)).toHaveLength(0);
    expect(switchOf('otp_en')).toBeChecked();
  });

  it('shows the refusal in the words of the code, with what it means, when the question was confirmed', async () => {
    only('otp_en');
    saved.set('auth.phone_login_enabled', {
      value: true,
      updatedAt: '2026-10-26T10:00:00Z',
      updatedBy: '1',
      updatedByUsername: 'root',
    });
    const { calls, user } = await load();
    await rowOf('otp_en');
    await user.click(switchOf('otp_en'));
    expect(
      await screen.findByText(/Phone sign-in is on \(auth\.phone_login_enabled\)/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(
      await screen.findByText(/Some input is not valid\. Please check the fields and try again\./),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toContain(
      'The last enabled OTP template cannot be removed',
    );
    await waitFor(() => expect(switchOf('otp_en')).toBeChecked());
  });
});

describe('deleting a template', () => {
  it('asks inline for a template that is not the last, and deletes with one request', async () => {
    const { calls, user } = await load();
    await user.click(within(await rowOf('promo_en')).getByRole('button', { name: 'Delete' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    const ok = await screen.findByRole('button', { name: 'OK' });
    const gate = holdWrites();
    fireEvent.click(ok);
    fireEvent.click(ok);
    await settled();
    expect(gate.started()).toBe(1);
    gate.release();
    await waitFor(() => expect(rows().some((tr) => cellsOf(tr)[0] === 'promo_en')).toBe(false));
    expect(writesOf(calls)).toHaveLength(1);
    expect(writesOf(calls)[0].method).toBe('DELETE');
  });

  it('asks first when it is the last enabled OTP template, and the delete goes out only when confirmed', async () => {
    only('otp_en');
    const { calls, user } = await load();
    await user.click(within(await rowOf('otp_en')).getByRole('button', { name: 'Delete' }));
    const ask = await screen.findByRole('dialog');
    await user.click(within(ask).getByRole('button', { name: 'Cancel' }));
    await settled();
    expect(writesOf(calls)).toHaveLength(0);
    await user.click(within(await rowOf('otp_en')).getByRole('button', { name: 'Delete' }));
    await user.click(
      (await screen.findAllByRole('button', { name: 'Continue' })).at(-1) as HTMLElement,
    );
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(await screen.findByText(/Some input is not valid/)).toBeInTheDocument();
    expect((await rowOf('otp_en')).textContent).toContain('otp_en');
  });

  it('asks first for the English template for every country, and says in the words of the code why it stays when the backend refuses', async () => {
    const { calls, user } = await load();
    await user.click(within(await rowOf('otp_en')).getByRole('button', { name: 'Delete' }));
    const ask = await screen.findByRole('dialog');
    expect(
      within(ask).getAllByText('This is the last enabled OTP template in English for every country')
        .length,
    ).toBeGreaterThan(0);
    await user.click(within(ask).getByRole('button', { name: 'Cancel' }));
    await settled();
    expect(writesOf(calls)).toHaveLength(0);
    await user.click(within(await rowOf('otp_en')).getByRole('button', { name: 'Delete' }));
    await user.click(
      (await screen.findAllByRole('button', { name: 'Continue' })).at(-1) as HTMLElement,
    );
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(
      await screen.findByText(/an enabled OTP template in English \(en\) for every country/),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('The value is outside the allowed range');
    expect(template('otp_en').enabled).toBe(true);
    expect((await rowOf('otp_en')).textContent).toContain('otp_en');
  });

  it('deletes the English template for every country when another one (EN, any case) remains', async () => {
    smsState.templates.set('90', {
      ...template('otp_en'),
      id: '90',
      templateCode: 'otp_EN',
      locale: 'EN',
    });
    const { calls, user } = await load();
    await user.click(within(await rowOf('otp_en')).getByRole('button', { name: 'Delete' }));
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    await waitFor(() => expect(rows().some((tr) => cellsOf(tr)[0] === 'otp_en')).toBe(false));
  });

  it('does not ask for a template that is off, even when it is OTP', async () => {
    only('otp_en');
    const { calls, user } = await load();
    await user.click(within(await rowOf('otp_long')).getByRole('button', { name: 'Delete' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
  });
});

describe('the English template for every country in the form (e2)', () => {
  const refuseTexts = /an enabled OTP template in English \(en\) for every country/;

  it('shows the words of the code at the top of the dialog when the language is moved away, keeps the dialog open and the other fields filled, and sends one request', async () => {
    const { calls, user } = await load();
    const form = await openEdit(user, 'otp_en');
    const locale = form.getByRole('textbox', { name: 'Language' });
    setText(locale, 'th');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    await user.click(
      (await screen.findAllByRole('button', { name: 'Continue' })).at(-1) as HTMLElement,
    );
    const bar = await screen.findByText(refuseTexts);
    expect(bar.closest('.ant-alert')).not.toBeNull();
    expect(writesOf(calls)).toHaveLength(1);
    expect(locale).toHaveValue('th');
    expect(document.body.textContent).not.toContain('The value is outside the allowed range');
    expect(document.body.textContent).not.toContain('The last enabled OTP template in language en');
    expect(template('otp_en').locale).toBe('en');
  });

  it('shows the same in Chinese when the interface is Chinese', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<TemplatesPage />, 'zh-CN');
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    await user.click(within(await rowOf('otp_en')).getByRole('button', { name: '编辑' }));
    const form = within(await dialog());
    setText(form.getByRole('textbox', { name: '语言' }), 'ar');
    await user.click(form.getByRole('button', { name: /提\s*交/ }));
    await user.click(
      (await screen.findAllByRole('button', { name: /继\s*续/ })).at(-1) as HTMLElement,
    );
    await waitFor(() =>
      expect(document.querySelector('.ant-modal .ant-alert-error')?.textContent).toMatch(
        /语言为英文（en）、不限国家的验证码模板/,
      ),
    );
  });

  it('asks first when the edit gives the English template a country, and sends nothing when declined', async () => {
    const { calls, user } = await load();
    const form = await openEdit(user, 'otp_en');
    setText(form.getByRole('textbox', { name: 'Country' }), 'TH');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    const ask = await screen.findAllByText(
      'This is the last enabled OTP template in English for every country',
    );
    expect(ask.length).toBeGreaterThan(0);
    await user.click(
      within(document.querySelector('.ant-modal-confirm') as HTMLElement).getByRole('button', {
        name: 'Cancel',
      }),
    );
    await settled();
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('does not ask for an edit of the English template that keeps it as the rule needs it', async () => {
    const { calls, user } = await load();
    const form = await openEdit(user, 'otp_en');
    setText(form.getByRole('textbox', { name: 'Name' }), 'English renamed');
    setText(form.getByRole('textbox', { name: 'Language' }), 'EN');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    await waitFor(() => expect(template('otp_en').name).toBe('English renamed'));
    expect(document.querySelector('.ant-modal-confirm')).toBeNull();
  });

  it('lets a country be added to a template that is not the English one for every country', async () => {
    const { user } = await load();
    const form = await openEdit(user, 'otp_ar');
    setText(form.getByRole('textbox', { name: 'Country' }), 'SA');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    await dialogsClosed();
    expect(template('otp_ar').country).toBe('SA');
  });
});

describe('changing the type of the last enabled OTP template', () => {
  it('asks first, and sends nothing when declined', async () => {
    only('otp_en');
    const { calls, user } = await load();
    const form = await openEdit(user, 'otp_en');
    await chooseOption(user, 'Type', 'Marketing', await dialog());
    await user.click(form.getByRole('button', { name: 'Submit' }));
    await screen.findAllByText('This is the last enabled OTP template');
    await user.click(
      within(document.querySelector('.ant-modal-confirm') as HTMLElement).getByRole('button', {
        name: 'Cancel',
      }),
    );
    await settled();
    expect(writesOf(calls)).toHaveLength(0);
  });
});
