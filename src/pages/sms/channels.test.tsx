import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { saved } from '../../../mock/_core/configStore';
import configMock from '../../../mock/config.mock';
import smsMock from '../../../mock/sms.mock';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import ChannelsPage from './channels';
import {
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
const switchOf = (code: string) => screen.getByRole('switch', { name: `Enabled: ${code}` });
const phoneLoginOn = () =>
  saved.set('auth.phone_login_enabled', {
    value: true,
    updatedAt: '2026-10-26T10:00:00Z',
    updatedBy: '1',
    updatedByUsername: 'root',
  });
const labelsIn = (row: Element) =>
  [...(row.querySelector('td:last-child') as Element).querySelectorAll('button')]
    .map((b) => (b.textContent ?? '').trim())
    .filter(Boolean);

describe('the list of channels', () => {
  it('shows the columns of the spec: code, name, provider, type, countries, priority, switch, credentials', async () => {
    await load();
    const headers = [...document.querySelectorAll('.ant-table-thead th')].map(
      (th) => th.textContent,
    );
    expect(headers).toEqual([
      'Code',
      'Name',
      'Provider',
      'Type',
      'Countries',
      'Priority',
      'Enabled',
      'Credentials',
      'Actions',
    ]);
    const th = cellsOf(await rowOf('gw_th_otp'));
    expect(th.slice(0, 6)).toEqual([
      'gw_th_otp',
      channel('gw_th_otp').name,
      'gateway-a',
      'OTP',
      'TH',
      '10',
    ]);
    expect(th[7]).toBe('Set');
    expect(cellsOf(await rowOf('gw_es_promo'))[7]).toBe('Not set');
    expect(cellsOf(await rowOf('gw_es_promo'))[3]).toBe('Marketing');
    expect(cellsOf(await rowOf('gw_es_promo'))[4]).toBe('All countries');
    expect(cellsOf(await rowOf('gw_ar_otp'))[4]).toBe('SAAEEG');
    expect(switchOf('gw_th_otp')).toBeChecked();
    expect(switchOf('gw_es_promo')).not.toBeChecked();
  });

  it('shows names in every language, and lets a name of 300 letters without a space break anywhere', async () => {
    await load();
    expect(screen.getByText(channel('gw_th_otp').name)).toBeInTheDocument();
    expect(screen.getByText(channel('gw_ar_otp').name)).toBeInTheDocument();
    expect(screen.getByText(channel('gw_sea_otp').name)).toBeInTheDocument();
    expect(screen.getByText(channel('gw_es_promo').name)).toBeInTheDocument();
    const long = screen.getByText('A'.repeat(300));
    expect((long.closest('button') as HTMLElement).style.overflowWrap).toBe('anywhere');
  });

  it('keeps a channel code and a provider code of 5000 letters without a space inside their columns', async () => {
    const found = channel('gw_th_otp');
    found.channelCode = 'K'.repeat(5000);
    found.providerCode = 'P'.repeat(5000);
    await load();
    for (const letter of ['K', 'P']) {
      const long = screen.getByText(letter.repeat(5000));
      expect((long.closest('button') as HTMLElement).style.overflowWrap).toBe('anywhere');
    }
  });

  it('shows the notes: how a channel is chosen, and that credentials are write-only', async () => {
    await load();
    expect(
      screen.getByText(/smallest priority number is used.*not retried on another channel/s),
    ).toBeInTheDocument();
    expect(screen.getByText(/never shown again after saving/)).toBeInTheDocument();
  });

  it('draws what it is given even when the values are not what the contract says', async () => {
    backend();
    overrideFetch(async ({ url, method }) =>
      method === 'GET' && url.pathname === '/api/admin/sms/channels'
        ? jsonAnswer(200, '200', {
            items: [
              {
                id: 7,
                channelCode: { a: 1 },
                name: ['x', 'y'],
                providerCode: null,
                smsType: 'VOICE',
                countries: 'TH',
                priority: 'soon',
                enabled: 'yes',
                hasCredentials: 'maybe',
                extConfig: 5,
              },
              null,
              'text',
            ],
            total: 3,
          })
        : undefined,
    );
    renderPage(<ChannelsPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    expect(document.body.textContent).toContain('"a":1');
    expect(document.body.textContent).toContain('VOICE');
  });

  it('says what went wrong in the words of the code, with a button to read again', async () => {
    backend();
    let fail = true;
    overrideFetch(async ({ url, method }) =>
      fail && method === 'GET' && url.pathname === '/api/admin/sms/channels'
        ? jsonAnswer(500, 'INTERNAL_ERROR', null, 'SECRET BACKEND WORDS')
        : undefined,
    );
    const user = userEvent.setup();
    renderPage(<ChannelsPage />);
    expect(await screen.findByText(/Failed to load/)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('SECRET BACKEND WORDS');
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
  });

  it('says in the words of the code when the providers could not be read, with a button to read again', async () => {
    backend();
    let fail = true;
    overrideFetch(async ({ url, method }) =>
      fail && method === 'GET' && url.pathname === '/api/admin/sms/meta'
        ? jsonAnswer(500, 'INTERNAL_ERROR', null, 'SECRET BACKEND WORDS')
        : undefined,
    );
    const user = userEvent.setup();
    renderPage(<ChannelsPage />);
    expect(await screen.findByText(/Failed to load/)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('SECRET BACKEND WORDS');
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.queryByText(/Failed to load/)).toBeNull());
    await user.click(screen.getByRole('button', { name: 'New channel' }));
    const form = within(await screen.findByRole('dialog'));
    await user.click(form.getByRole('combobox', { name: 'Provider' }));
    expect(
      await screen.findByText('gateway-a', { selector: '.ant-select-item-option-content' }),
    ).toBeInTheDocument();
  });

  it('keeps the answer of the newest read when an older one arrives late', async () => {
    backend();
    let reads = 0;
    let letOldGo: () => void = () => {};
    overrideFetch(async ({ url, method }) => {
      if (method !== 'GET' || url.pathname !== '/api/admin/sms/channels') return undefined;
      if (url.searchParams.get('pageSize') !== '20') return undefined;
      reads += 1;
      if (reads !== 2) return undefined;
      await new Promise<void>((resolve) => {
        letOldGo = resolve;
      });
      return jsonAnswer(200, '200', {
        items: [{ id: '1', channelCode: 'OLD_ANSWER', hasCredentials: true }],
        total: 1,
      });
    });
    const user = userEvent.setup();
    renderPage(<ChannelsPage />);
    await waitFor(() => expect(rows().length).toBe(5));
    // Two switches are pressed one after the other: each reads the list again, the first read is slow.
    await user.click(switchOf('gw_es_promo'));
    await waitFor(() => expect(reads).toBeGreaterThanOrEqual(2));
    // The table is greyed out while the slow read is on its way (pointer-events: none): the press goes in as an event.
    fireEvent.click(switchOf('gw_all_backup'));
    await waitFor(() => expect(reads).toBeGreaterThanOrEqual(3));
    await waitFor(() => expect(switchOf('gw_all_backup')).toBeChecked());
    letOldGo();
    await settled();
    expect(document.body.textContent).not.toContain('OLD_ANSWER');
    expect(rows().length).toBe(5);
  });
});

describe('who can change what', () => {
  it('shows the write buttons and the switches to an administrator with SMS:CHANNEL:CONFIG', async () => {
    await load();
    expect(screen.getByRole('button', { name: 'New channel' })).toBeInTheDocument();
    expect(labelsIn(await rowOf('gw_th_otp'))).toEqual(['Edit', 'Test send', 'Delete']);
    expect(switchOf('gw_th_otp')).not.toBeDisabled();
  });

  it('shows none of them, and a note, to an administrator who can only read', async () => {
    signIn('support', { codes: ['SMS:CHANNEL'] });
    await load();
    expect(screen.queryByRole('button', { name: 'New channel' })).toBeNull();
    expect(labelsIn(await rowOf('gw_th_otp'))).toEqual([]);
    expect(switchOf('gw_th_otp')).toBeDisabled();
    expect(screen.getByText(/can only view channels/)).toBeInTheDocument();
  });
});

describe('the switch of a channel', () => {
  it('turns a channel on at once with one request, and shows what the backend then holds', async () => {
    const { calls, user } = await load();
    await rowOf('gw_es_promo');
    await user.click(switchOf('gw_es_promo'));
    await waitFor(() => expect(switchOf('gw_es_promo')).toBeChecked());
    expect(writesOf(calls)).toEqual([
      expect.objectContaining({
        method: 'PUT',
        url: `/api/admin/sms/channels/${channel('gw_es_promo').id}/enabled`,
        body: { enabled: true },
      }),
    ]);
    expect(channel('gw_es_promo').enabled).toBe(true);
  });

  it('sends one request when the switch is pressed twice', async () => {
    const { calls, user } = await load();
    await rowOf('gw_es_promo');
    const gate = holdWrites();
    const toggle = switchOf('gw_es_promo');
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    await settled();
    expect(gate.started()).toBe(1);
    gate.release();
    await settled();
    expect(writesOf(calls)).toHaveLength(1);
    void user;
  });

  it('switches off a channel without a question when another enabled OTP channel serves its countries', async () => {
    channel('gw_all_backup').enabled = true;
    const { calls, user } = await load();
    await rowOf('gw_th_otp');
    await user.click(switchOf('gw_th_otp'));
    await waitFor(() => expect(switchOf('gw_th_otp')).not.toBeChecked());
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(writesOf(calls)).toHaveLength(1);
  });

  it('shows the words of the error code and not the backend message when the change is refused', async () => {
    backend();
    overrideFetch(async ({ method, url }) =>
      method === 'PUT' && url.pathname.endsWith('/enabled')
        ? jsonAnswer(404, 'RESOURCE_NOT_FOUND', null, 'SECRET BACKEND WORDS')
        : undefined,
    );
    const user = userEvent.setup();
    renderPage(<ChannelsPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    await user.click(switchOf('gw_es_promo'));
    expect(await screen.findByText('The item was not found.')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('SECRET BACKEND WORDS');
  });

  it('shows that the session has ended and does not send the write again', async () => {
    backend();
    const taken = overrideFetch(async ({ method, url }) =>
      method === 'PUT' && url.pathname.endsWith('/enabled')
        ? jsonAnswer(401, 'ADMIN_INVALID_TOKEN', null, 'SECRET BACKEND WORDS')
        : undefined,
    );
    const user = userEvent.setup();
    renderPage(<ChannelsPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    await user.click(switchOf('gw_es_promo'));
    expect(
      await screen.findByText('Your session has expired. Please sign in again.'),
    ).toBeInTheDocument();
    await settled();
    expect(taken).toHaveLength(1);
  });
});

describe('the question before the last enabled OTP channel is switched off, deleted or changed', () => {
  // The seed has three enabled OTP channels for different countries: each is the last one for its own.
  it('is asked when the last channel is switched off, names both conditions, and sends nothing when it is declined', async () => {
    phoneLoginOn();
    const { calls, user } = await load();
    await rowOf('gw_th_otp');
    await user.click(switchOf('gw_th_otp'));
    const ask = await screen.findByRole('dialog');
    expect(within(ask).getAllByText('This is the last enabled OTP channel').length).toBeGreaterThan(
      0,
    );
    expect(
      within(ask).getByText(/Phone sign-in is on \(auth\.phone_login_enabled\)/),
    ).toBeInTheDocument();
    expect(within(ask).getByText(/accounts that sign in with a phone number/)).toBeInTheDocument();
    await user.click(within(ask).getByRole('button', { name: 'Cancel' }));
    await settled();
    expect(writesOf(calls)).toHaveLength(0);
    expect(switchOf('gw_th_otp')).toBeChecked();
  });

  it('sends the request when the question is confirmed, and shows the refusal in the words of the code with what it means', async () => {
    phoneLoginOn();
    const { calls, user } = await load();
    await rowOf('gw_th_otp');
    await user.click(switchOf('gw_th_otp'));
    await user.click(await screen.findByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(
      await screen.findByText(/Some input is not valid\. Please check the fields and try again\./),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/refuses this while phone sign-in is on or phone-number accounts exist/),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('The last enabled OTP channel of a country');
    await waitFor(() => expect(switchOf('gw_th_otp')).toBeChecked());
    expect(channel('gw_th_otp').enabled).toBe(true);
  });

  it('says what a refusal means also for a channel that the page did not take for the last one', async () => {
    channel('gw_all_backup').enabled = true;
    backend();
    overrideFetch(async ({ method, url }) =>
      method === 'PUT' && url.pathname.endsWith('/enabled')
        ? jsonAnswer(400, 'INVALID_REQUEST', null, 'SECRET BACKEND WORDS')
        : undefined,
    );
    const user = userEvent.setup();
    renderPage(<ChannelsPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    await user.click(switchOf('gw_th_otp'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(
      await screen.findByText(
        /Some input is not valid.*refuses this while phone sign-in is on or phone-number accounts exist/s,
      ),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('SECRET BACKEND WORDS');
  });

  it('says that phone sign-in is off, and that phone-number accounts still count, when the setting is readable and off', async () => {
    const { user } = await load();
    await rowOf('gw_th_otp');
    await user.click(switchOf('gw_th_otp'));
    const ask = await screen.findByRole('dialog');
    expect(
      within(ask).getByText(/Phone sign-in is off \(auth\.phone_login_enabled\)/),
    ).toBeInTheDocument();
    expect(within(ask).getByText(/accounts that sign in with a phone number/)).toBeInTheDocument();
  });

  it('says that it cannot read the setting when the administrator may not see it, and still names both conditions', async () => {
    signIn('support', { codes: ['SMS:CHANNEL', 'SMS:CHANNEL:CONFIG'] });
    const { user } = await load();
    await rowOf('gw_th_otp');
    await user.click(switchOf('gw_th_otp'));
    const ask = await screen.findByRole('dialog');
    expect(within(ask).getByText(/cannot read whether phone sign-in is on/)).toBeInTheDocument();
    expect(within(ask).getByText(/accounts that sign in with a phone number/)).toBeInTheDocument();
  });

  it('reads the setting when the question is asked, not when the page was opened', async () => {
    const { user } = await load();
    await rowOf('gw_th_otp');
    phoneLoginOn();
    await user.click(switchOf('gw_th_otp'));
    expect(
      await screen.findByText(/Phone sign-in is on \(auth\.phone_login_enabled\)/),
    ).toBeInTheDocument();
  });

  it('is asked when the list of channels could not be read in full: it is taken as the last one', async () => {
    backend();
    overrideFetch(async ({ url, method }) =>
      method === 'GET' &&
      url.pathname === '/api/admin/sms/channels' &&
      url.searchParams.get('pageSize') === '200'
        ? jsonAnswer(500, 'INTERNAL_ERROR')
        : undefined,
    );
    channel('gw_all_backup').enabled = true;
    const user = userEvent.setup();
    renderPage(<ChannelsPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    await user.click(switchOf('gw_th_otp'));
    expect(
      (await screen.findAllByText('This is the last enabled OTP channel')).length,
    ).toBeGreaterThan(0);
  });

  it('is not asked for a channel that is off or is not OTP, and these are deleted with the inline question', async () => {
    const { calls, user } = await load();
    const row = await rowOf('gw_es_promo');
    const id = channel('gw_es_promo').id;
    await user.click(within(row).getByRole('button', { name: 'Delete' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0]).toMatchObject({
      method: 'DELETE',
      url: `/api/admin/sms/channels/${id}`,
    });
    await waitFor(() => expect(rows().some((tr) => cellsOf(tr)[0] === 'gw_es_promo')).toBe(false));
  });

  it('says what a refusal means when an enabled OTP channel that is not the last is deleted with the inline question', async () => {
    channel('gw_all_backup').enabled = true;
    backend();
    overrideFetch(async ({ method }) =>
      method === 'DELETE'
        ? jsonAnswer(400, 'INVALID_REQUEST', null, 'SECRET BACKEND WORDS')
        : undefined,
    );
    const user = userEvent.setup();
    renderPage(<ChannelsPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    await user.click(within(await rowOf('gw_th_otp')).getByRole('button', { name: 'Delete' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    expect(
      await screen.findByText(
        /Some input is not valid.*refuses this while phone sign-in is on or phone-number accounts exist/s,
      ),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('SECRET BACKEND WORDS');
  });

  it('is asked when the last channel is deleted, and the delete goes out only when the question is confirmed', async () => {
    phoneLoginOn();
    const { calls, user } = await load();
    await user.click(within(await rowOf('gw_th_otp')).getByRole('button', { name: 'Delete' }));
    const ask = await screen.findByRole('dialog');
    expect(within(ask).getByText(/delete it/i)).toBeInTheDocument();
    await user.click(within(ask).getByRole('button', { name: 'Cancel' }));
    await settled();
    expect(writesOf(calls)).toHaveLength(0);
    await user.click(within(await rowOf('gw_th_otp')).getByRole('button', { name: 'Delete' }));
    await user.click(
      (await screen.findAllByRole('button', { name: 'Continue' })).at(-1) as HTMLElement,
    );
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(
      await screen.findByText(/Some input is not valid\. Please check the fields and try again\./),
    ).toBeInTheDocument();
    expect((await rowOf('gw_th_otp')).textContent).toContain('gw_th_otp');
  });

  it('deletes the last channel when the backend allows it (no phone sign-in, no phone accounts)', async () => {
    smsState.phoneAccounts = 0;
    const { calls, user } = await load();
    await user.click(within(await rowOf('gw_th_otp')).getByRole('button', { name: 'Delete' }));
    await user.click(await screen.findByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    await waitFor(() => expect(rows().some((tr) => cellsOf(tr)[0] === 'gw_th_otp')).toBe(false));
    expect(screen.queryByText(/Some input is not valid/)).toBeNull();
  });

  it('sends one delete when the inline question is confirmed twice', async () => {
    const { calls, user } = await load();
    await user.click(within(await rowOf('gw_es_promo')).getByRole('button', { name: 'Delete' }));
    const ok = await screen.findByRole('button', { name: 'OK' });
    const gate = holdWrites();
    fireEvent.click(ok);
    fireEvent.click(ok);
    await settled();
    expect(gate.started()).toBe(1);
    gate.release();
    await settled();
    expect(writesOf(calls)).toHaveLength(1);
  });
});
