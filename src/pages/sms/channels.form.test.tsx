import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import configMock from '../../../mock/config.mock';
import smsMock from '../../../mock/sms.mock';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import ChannelsPage from './channels';
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
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const SECRET = 'LEAKED-SECRET-9f3a';
const rows = () => [...document.querySelectorAll('.ant-table-tbody tr.ant-table-row')];
const cellsOf = (tr: Element) => [...tr.querySelectorAll('td')].map((td) => td.textContent ?? '');
const channel = (code: string) => {
  const found = [...smsState.channels.values()].find((c) => c.channelCode === code);
  if (!found) throw new Error(`no channel ${code}`);
  return found;
};
const rowOf = async (code: string) => {
  await waitFor(() => expect(rows().some((tr) => cellsOf(tr)[0] === code)).toBe(true));
  return rows().find((tr) => cellsOf(tr)[0] === code) as HTMLTableRowElement;
};
const load = async () => {
  const calls = backend();
  const user = userEvent.setup();
  renderPage(<ChannelsPage />);
  await waitFor(() => expect(rows().length).toBeGreaterThan(0));
  return { calls, user };
};
const dialog = () => screen.findByRole('dialog');
const openNew = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'New channel' }));
  return within(await dialog());
};
const openEdit = async (user: ReturnType<typeof userEvent.setup>, code: string) => {
  await user.click(within(await rowOf(code)).getByRole('button', { name: 'Edit' }));
  return within(await dialog());
};
const pick = (input: HTMLElement, value: string) => {
  fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key: 'Enter', keyCode: 13 });
};
const setText = (input: HTMLElement, value: string) =>
  fireEvent.change(input, { target: { value } });

/** Fills what a new channel needs, with the values of `over` where it has them. */
async function fillNew(
  user: ReturnType<typeof userEvent.setup>,
  form: ReturnType<typeof within>,
  over: Partial<Record<'code' | 'name' | 'url' | 'credentials' | 'ext' | 'priority', string>> = {},
) {
  await user.type(form.getByRole('textbox', { name: 'Channel code' }), over.code ?? 'gw_new');
  await user.type(form.getByRole('textbox', { name: 'Name' }), over.name ?? 'New channel ไทย');
  await chooseOption(user, 'Provider', 'gateway-a', await dialog());
  setText(
    form.getByRole('textbox', { name: 'API address' }),
    over.url ?? 'https://sms.example.com/v1/send',
  );
  if (over.credentials !== undefined) setText(form.getByLabelText('Credentials'), over.credentials);
  if (over.ext !== undefined)
    setText(form.getByRole('textbox', { name: 'Extension (JSON)' }), over.ext);
  await chooseOption(user, 'Type', 'OTP', await dialog());
  setText(form.getByRole('spinbutton', { name: 'Priority' }), over.priority ?? '40');
}

/** Wraps the fetch that is there (the mock backend) so that every channel it answers also carries secrets, as a backend that went wrong would. */
function leakSecrets() {
  const inner = globalThis.fetch;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL, init: RequestInit = {}) => {
      const response = await inner(input, init);
      const url = new URL(String(input), 'http://localhost');
      if (!url.pathname.startsWith('/api/admin/sms/channels') || response.status !== 200)
        return response;
      const body = (await response.json()) as { data: unknown };
      const dirty = (row: Record<string, unknown>) => ({
        ...row,
        credentials: SECRET,
        credentialsEnc: SECRET,
        apiSecret: SECRET,
        accessToken: SECRET,
        secret: SECRET,
        password: SECRET,
      });
      const data = body.data as
        | { items?: Record<string, unknown>[] }
        | Record<string, unknown>
        | null;
      if (data && 'items' in data && Array.isArray(data.items)) data.items = data.items.map(dirty);
      else if (data && !Array.isArray(data)) body.data = dirty(data as Record<string, unknown>);
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
}

describe('the credentials are write-only', () => {
  it('are nowhere in the page when the backend sends them by mistake: not in a cell, a tooltip, a title or an attribute', async () => {
    backend();
    leakSecrets();
    renderPage(<ChannelsPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    expect(document.body.innerHTML).not.toContain(SECRET);
    expect(document.body.textContent).not.toContain(SECRET);
    // The indicator comes from hasCredentials and from nothing else.
    expect(cellsOf(await rowOf('gw_th_otp'))[7]).toBe('Set');
    expect(cellsOf(await rowOf('gw_es_promo'))[7]).toBe('Not set');
  });

  it('keep the box empty when a channel is edited, also when the backend sends the credentials by mistake', async () => {
    backend();
    leakSecrets();
    const user = userEvent.setup();
    renderPage(<ChannelsPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    const form = await openEdit(user, 'gw_th_otp');
    const box = form.getByLabelText('Credentials') as HTMLInputElement;
    expect(box.value).toBe('');
    expect(box.type).toBe('password');
    expect(box.autocomplete).toBe('new-password');
    expect(document.body.innerHTML).not.toContain(SECRET);
    expect(form.getByText(/Credentials are set/)).toBeInTheDocument();
    expect(form.getByText(/Leave this box empty to keep them/)).toBeInTheDocument();
  });

  it('say so when none are set yet', async () => {
    const { user } = await load();
    const form = await openEdit(user, 'gw_es_promo');
    expect(form.getByText(/No credentials are set yet/)).toBeInTheDocument();
  });

  it('are not in the request of an edit that did not type any, which carries the editable fields and no other', async () => {
    const calls = backend();
    leakSecrets();
    const user = userEvent.setup();
    renderPage(<ChannelsPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    const form = await openEdit(user, 'gw_th_otp');
    setText(form.getByRole('textbox', { name: 'Name' }), 'Renamed channel');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    const write = writesOf(calls)[0];
    expect(write).toMatchObject({
      method: 'PUT',
      url: `/api/admin/sms/channels/${channel('gw_th_otp').id}`,
    });
    const body = write.body as Record<string, unknown>;
    expect('credentials' in body).toBe(false);
    expect(Object.keys(body).sort()).toEqual(
      ['apiUrl', 'countries', 'extConfig', 'name', 'priority', 'providerCode', 'smsType'].sort(),
    );
    expect(JSON.stringify(body)).not.toContain(SECRET);
    // The credentials the backend holds are untouched.
    expect(channel('gw_th_otp').credentials).toBe('seed-secret-1');
  });

  it('are not in the request of an edit where only blanks were typed', async () => {
    const { calls, user } = await load();
    const form = await openEdit(user, 'gw_th_otp');
    setText(form.getByLabelText('Credentials'), '   ');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect('credentials' in (writesOf(calls)[0].body as object)).toBe(false);
    expect(channel('gw_th_otp').credentials).toBe('seed-secret-1');
  });

  it('go in the request once when typed, without the blanks around them, and the dialog and the list do not show them afterwards', async () => {
    const { calls, user } = await load();
    const form = await openEdit(user, 'gw_th_otp');
    setText(form.getByLabelText('Credentials'), '  fresh-secret-77 ');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect((writesOf(calls)[0].body as { credentials: string }).credentials).toBe(
      'fresh-secret-77',
    );
    expect(channel('gw_th_otp').credentials).toBe('fresh-secret-77');
    await dialogsClosed();
    expect(document.body.innerHTML).not.toContain('fresh-secret-77');
    // The box is empty when the channel is opened again.
    const again = await openEdit(user, 'gw_th_otp');
    expect((again.getByLabelText('Credentials') as HTMLInputElement).value).toBe('');
  });

  it('are not shown in the failure of a save, and what was typed stays only in the box', async () => {
    backend();
    overrideFetch(async ({ method }) =>
      method === 'PUT'
        ? jsonAnswer(400, 'INVALID_REQUEST', null, `SECRET BACKEND WORDS ${SECRET}`)
        : undefined,
    );
    const user = userEvent.setup();
    renderPage(<ChannelsPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    const form = await openEdit(user, 'gw_th_otp');
    setText(form.getByLabelText('Credentials'), 'typed-secret-55');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    expect(
      await screen.findByText('Some input is not valid. Please check the fields and try again.'),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('typed-secret-55');
    expect(document.body.textContent).not.toContain(SECRET);
    expect(document.body.textContent).not.toContain('SECRET BACKEND WORDS');
  });

  it('are sent on a create when typed and left out when not', async () => {
    const { calls, user } = await load();
    let form = await openNew(user);
    await fillNew(user, form, { credentials: ' typed-secret ' });
    await user.click(form.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect((writesOf(calls)[0].body as { credentials: string }).credentials).toBe('typed-secret');
    await dialogsClosed();
    form = await openNew(user);
    await fillNew(user, form, { code: 'gw_second' });
    await user.click(form.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(2));
    expect('credentials' in (writesOf(calls)[1].body as object)).toBe(false);
    expect(channel('gw_second').credentials).toBeNull();
  });
});

describe('the dialog', () => {
  it('creates a channel with the values as they are written and shows it in the list', async () => {
    const { calls, user } = await load();
    const form = await openNew(user);
    await fillNew(user, form, { ext: '{"appId":"a1","senderIds":{"TH":"AV"}}' });
    pick(form.getByRole('combobox', { name: 'Countries' }), 'th');
    pick(form.getByRole('combobox', { name: 'Countries' }), 'vn');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0]).toMatchObject({
      method: 'POST',
      url: '/api/admin/sms/channels',
      body: {
        channelCode: 'gw_new',
        name: 'New channel ไทย',
        providerCode: 'gateway-a',
        apiUrl: 'https://sms.example.com/v1/send',
        extConfig: { appId: 'a1', senderIds: { TH: 'AV' } },
        countries: ['TH', 'VN'],
        smsType: 'OTP',
        priority: 40,
        enabled: false,
      },
    });
    expect(await rowOf('gw_new')).toBeTruthy();
  });

  it('takes the providers from the meta of the backend', async () => {
    backend();
    overrideFetch(async ({ method, url }) =>
      method === 'GET' && url.pathname === '/api/admin/sms/meta'
        ? jsonAnswer(200, '200', {
            providers: [{ code: 'only-provider', allowedHosts: ['h.example.com'] }],
            testRemainingToday: 1,
          })
        : undefined,
    );
    const user = userEvent.setup();
    renderPage(<ChannelsPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    const form = await openNew(user);
    await user.click(form.getByRole('combobox', { name: 'Provider' }));
    const options = await screen.findAllByText(/provider/, {
      selector: '.ant-select-item-option-content',
    });
    expect(options.map((o) => o.textContent)).toEqual(['only-provider']);
    expect(
      screen.queryByText('gateway-a', { selector: '.ant-select-item-option-content' }),
    ).toBeNull();
  });

  it('shows the hosts the chosen provider allows, and refuses an address that is not https or has another host', async () => {
    const { calls, user } = await load();
    const form = await openNew(user);
    await chooseOption(user, 'Provider', 'gateway-b', await dialog());
    expect(form.getByText(/gw\.example\.org/)).toBeInTheDocument();
    const url = form.getByRole('textbox', { name: 'API address' });
    setText(url, 'http://gw.example.org/x');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    expect(await form.findByText('The address must start with https://')).toBeInTheDocument();
    setText(url, 'https://evil.example.net/x');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    expect(await form.findByText(/only allows these hosts: gw\.example\.org/)).toBeInTheDocument();
    setText(url, 'gw.example.org');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    expect(await form.findByText(/full address starting with https/)).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('checks the code, the name, the provider, the type and the priority before it sends anything', async () => {
    const { calls, user } = await load();
    const form = await openNew(user);
    await user.click(form.getByRole('button', { name: 'Submit' }));
    expect(await form.findByText('Enter the channel code')).toBeInTheDocument();
    expect(form.getByText('Enter the name')).toBeInTheDocument();
    expect(form.getByText('Choose a provider')).toBeInTheDocument();
    expect(form.getByText('Enter the API address')).toBeInTheDocument();
    expect(form.getByText('Choose a type')).toBeInTheDocument();
    await user.type(form.getByRole('textbox', { name: 'Channel code' }), 'has space');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    expect(await form.findByText(/letters, digits, hyphens and underscores/)).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('refuses a code that another channel already has, before anything is sent', async () => {
    const { calls, user } = await load();
    const form = await openNew(user);
    await fillNew(user, form, { code: 'gw_th_otp' });
    await user.click(form.getByRole('button', { name: 'Submit' }));
    expect(await form.findByText('A channel with this code already exists')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
    expect(smsState.channels.size).toBe(5);
  });

  it('shows the words of the code when the backend says the code is taken, and keeps the dialog open', async () => {
    backend();
    overrideFetch(async ({ method }) =>
      method === 'POST'
        ? jsonAnswer(409, 'DUPLICATE_RESOURCE', { field: 'channelCode' }, 'SECRET BACKEND WORDS')
        : undefined,
    );
    const user = userEvent.setup();
    renderPage(<ChannelsPage />);
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
            {
              details: [
                { ref: 'apiUrl', reason: 'INVALID_HOST' },
                { ref: 'priority', reason: 'UNKNOWN_REASON' },
              ],
            },
            'SECRET BACKEND WORDS',
          )
        : undefined,
    );
    const user = userEvent.setup();
    renderPage(<ChannelsPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    const form = await openNew(user);
    await fillNew(user, form);
    await user.click(form.getByRole('button', { name: 'Submit' }));
    expect(await form.findByText(/The host is not valid/)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('SECRET BACKEND WORDS');
    expect(document.body.textContent).not.toContain('UNKNOWN_REASON');
  });

  it('reads the extension as JSON: text that is not JSON, and JSON that is not an object, are refused', async () => {
    const { calls, user } = await load();
    const form = await openNew(user);
    await fillNew(user, form, { ext: '{"appId": ' });
    await user.click(form.getByRole('button', { name: 'Submit' }));
    expect(await form.findByText('The extension is not valid JSON')).toBeInTheDocument();
    setText(form.getByRole('textbox', { name: 'Extension (JSON)' }), '[1,2]');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    expect(await form.findByText('The extension must be a JSON object')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
    setText(form.getByRole('textbox', { name: 'Extension (JSON)' }), '');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect((writesOf(calls)[0].body as { extConfig: unknown }).extConfig).toBeNull();
  });

  it('refuses a country that is not two letters and writes the others in capitals', async () => {
    const { calls, user } = await load();
    const form = await openNew(user);
    await fillNew(user, form);
    pick(form.getByRole('combobox', { name: 'Countries' }), 'THA');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    expect(await form.findByText(/Country codes are two letters/)).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('refuses a priority that is not a whole number', async () => {
    const { calls, user } = await load();
    const form = await openNew(user);
    await fillNew(user, form, { priority: '' });
    await user.click(form.getByRole('button', { name: 'Submit' }));
    expect(await form.findByText('Enter a whole number')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('shows the code as text that cannot be edited, and sends no code, when a channel is edited', async () => {
    const { calls, user } = await load();
    const form = await openEdit(user, 'gw_th_otp');
    expect(form.queryByRole('textbox', { name: 'Channel code' })).toBeNull();
    expect(form.getByText('gw_th_otp')).toBeInTheDocument();
    expect(form.queryByRole('switch', { name: 'Enabled' })).toBeNull();
    await user.click(form.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect('channelCode' in (writesOf(calls)[0].body as object)).toBe(false);
    expect('enabled' in (writesOf(calls)[0].body as object)).toBe(false);
  });

  it('is filled with the channel that is edited', async () => {
    const { user } = await load();
    const form = await openEdit(user, 'gw_sea_otp');
    expect(form.getByRole('textbox', { name: 'Name' })).toHaveValue(channel('gw_sea_otp').name);
    expect(form.getByRole('textbox', { name: 'API address' })).toHaveValue(
      'https://gw.example.org/api/otp',
    );
    expect(form.getByRole('spinbutton', { name: 'Priority' })).toHaveValue('20');
    expect(form.getByRole('textbox', { name: 'Extension (JSON)' })).toHaveValue(
      JSON.stringify({ appId: 'app-sea', senderIds: { ID: 'AVATAR', VN: 'AVATAR' } }, null, 2),
    );
    expect(within(await dialog()).getByText('ID')).toBeInTheDocument();
    expect(within(await dialog()).getByText('VN')).toBeInTheDocument();
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
    fireEvent.submit(document.querySelector('.ant-modal form') as Element);
    await settled();
    expect(gate.started()).toBe(1);
    gate.release();
    await settled();
    expect(writesOf(calls)).toHaveLength(1);
  });

  it('shows that the session has ended, in the words of the code, and does not send the write again', async () => {
    backend();
    const taken = overrideFetch(async ({ method }) =>
      method === 'POST'
        ? jsonAnswer(401, 'ADMIN_INVALID_TOKEN', null, 'SECRET BACKEND WORDS')
        : undefined,
    );
    const user = userEvent.setup();
    renderPage(<ChannelsPage />);
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

  it('shows what was edited, not what was typed in a dialog that was closed before', async () => {
    const { user } = await load();
    let form = await openNew(user);
    await user.type(form.getByRole('textbox', { name: 'Name' }), 'Typed and abandoned');
    setText(form.getByLabelText('Credentials'), 'abandoned-secret');
    await user.click(form.getByRole('button', { name: 'Cancel' }));
    await dialogsClosed();
    form = await openEdit(user, 'gw_ar_otp');
    expect(form.getByRole('textbox', { name: 'Name' })).toHaveValue(channel('gw_ar_otp').name);
    expect((form.getByLabelText('Credentials') as HTMLInputElement).value).toBe('');
    await user.click(form.getByRole('button', { name: 'Cancel' }));
    await dialogsClosed();
    form = await openNew(user);
    expect(form.getByRole('textbox', { name: 'Name' })).toHaveValue('');
    expect(form.getByRole('textbox', { name: 'Channel code' })).toHaveValue('');
  });

  it('is laid out with a name of 5000 letters without a space: the field takes it and the table does not widen', async () => {
    const { user } = await load();
    const form = await openNew(user);
    setText(form.getByRole('textbox', { name: 'Name' }), 'ก'.repeat(5000));
    expect((form.getByRole('textbox', { name: 'Name' }) as HTMLInputElement).value.length).toBe(
      5000,
    );
  });
});

describe('a channel that is not what the contract says', () => {
  it('can still be opened for edit: the box is empty, the fields that are not usable are empty, and nothing is drawn as a crash', async () => {
    backend();
    overrideFetch(async ({ url, method }) =>
      method === 'GET' && url.pathname === '/api/admin/sms/channels'
        ? jsonAnswer(200, '200', {
            items: [
              {
                id: 7,
                channelCode: 'odd_one',
                name: { a: 1 },
                providerCode: null,
                apiUrl: 5,
                smsType: 'VOICE',
                countries: 'TH',
                priority: 'soon',
                enabled: 'yes',
                hasCredentials: 'maybe',
                extConfig: [1, 2],
                credentials: SECRET,
              },
            ],
            total: 1,
          })
        : undefined,
    );
    const user = userEvent.setup();
    renderPage(<ChannelsPage />);
    await waitFor(() => expect(rows().length).toBe(1));
    const form = await openEdit(user, 'odd_one');
    expect((form.getByLabelText('Credentials') as HTMLInputElement).value).toBe('');
    expect(form.getByRole('textbox', { name: 'Extension (JSON)' })).toHaveValue('[\n  1,\n  2\n]');
    expect(form.getByRole('spinbutton', { name: 'Priority' })).toHaveValue('');
    expect(document.body.innerHTML).not.toContain(SECRET);
  });
});

describe('the question before a change that takes the last OTP coverage away', () => {
  const editType = async (user: ReturnType<typeof userEvent.setup>, code: string, type: string) => {
    const form = await openEdit(user, code);
    await chooseOption(user, 'Type', type, await dialog());
    await user.click(form.getByRole('button', { name: 'Submit' }));
  };

  it('is asked when the last channel is turned into another type, and nothing is sent when it is declined', async () => {
    const { calls, user } = await load();
    await editType(user, 'gw_th_otp', 'Marketing');
    expect(
      (await screen.findAllByText('This is the last enabled OTP channel')).length,
    ).toBeGreaterThan(0);
    await user.click(
      within(document.querySelector('.ant-modal-confirm') as HTMLElement).getByRole('button', {
        name: 'Cancel',
      }),
    );
    await settled();
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('is asked when countries that only this channel serves are taken away, and the save goes out when it is confirmed', async () => {
    const { calls, user } = await load();
    const form = await openEdit(user, 'gw_sea_otp');
    // ID and VN are served by this channel only; taking VN away leaves VN without an OTP channel.
    const dialogEl = await dialog();
    const tags = [...dialogEl.querySelectorAll('.ant-select-selection-item')];
    const vn = tags.find((t) => t.textContent === 'VN') as HTMLElement;
    fireEvent.click(vn.querySelector('.ant-select-selection-item-remove') as Element);
    await user.click(form.getByRole('button', { name: 'Submit' }));
    await screen.findAllByText('This is the last enabled OTP channel');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect((writesOf(calls)[0].body as { countries: string[] }).countries).toEqual(['ID']);
  });

  it('is not asked when the change keeps what the channel alone served', async () => {
    const { calls, user } = await load();
    const form = await openEdit(user, 'gw_th_otp');
    pick(form.getByRole('combobox', { name: 'Countries' }), 'la');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(screen.queryByText('This is the last enabled OTP channel')).toBeNull();
  });

  it('is not asked when another enabled OTP channel serves the same countries', async () => {
    channel('gw_all_backup').enabled = true;
    const { calls, user } = await load();
    await editType(user, 'gw_th_otp', 'Marketing');
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(screen.queryByText('This is the last enabled OTP channel')).toBeNull();
  });

  it('is not asked for a channel that is not enabled', async () => {
    const { calls, user } = await load();
    await editType(user, 'gw_all_backup', 'Marketing');
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(screen.queryByText('This is the last enabled OTP channel')).toBeNull();
  });
});
