import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TEST_PER_DAY } from '../../../mock/_core/smsData';
import configMock from '../../../mock/config.mock';
import smsMock from '../../../mock/sms.mock';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import ChannelsPage from './channels';
import {
  dialogsClosed,
  holdWrites,
  jsonAnswer,
  overrideFetch,
  settled,
  signIn,
  smsState,
  writesOf,
} from './testSetup';

const backend = () => useMockBackend({ default: smsMock }, { default: configMock });

beforeEach(() => {
  signIn('root');
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const NUMBER = '+66812345678';
const rows = () => [...document.querySelectorAll('.ant-table-tbody tr.ant-table-row')];
const cellsOf = (tr: Element) => [...tr.querySelectorAll('td')].map((td) => td.textContent ?? '');
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
const openTest = async (user: ReturnType<typeof userEvent.setup>, code = 'gw_th_otp') => {
  await user.click(within(await rowOf(code)).getByRole('button', { name: 'Test send' }));
  return within(await screen.findByRole('dialog'));
};
const setText = (input: HTMLElement, value: string) =>
  fireEvent.change(input, { target: { value } });

describe('the test send', () => {
  it('is offered with SMS:CHANNEL:CONFIG and not without it', async () => {
    signIn('support', { codes: ['SMS:CHANNEL', 'SMS:TEMPLATE'] });
    await load();
    expect(screen.queryByRole('button', { name: 'Test send' })).toBeNull();
  });

  it('shows how many test messages are left today, read when the dialog is opened, and says that the text is fixed', async () => {
    const { user } = await load();
    const form = await openTest(user);
    expect(await form.findByText(`Test messages left today: ${TEST_PER_DAY}`)).toBeInTheDocument();
    expect(form.getByText(/text is fixed and cannot be changed/)).toBeInTheDocument();
  });

  it('sends to the number that was typed, once, and the dialog counts one less the next time', async () => {
    const { calls, user } = await load();
    let form = await openTest(user);
    await form.findByText(`Test messages left today: ${TEST_PER_DAY}`);
    setText(form.getByRole('textbox', { name: 'Phone number' }), `  ${NUMBER} `);
    await user.click(form.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0]).toMatchObject({
      method: 'POST',
      url: `/api/admin/sms/channels/${[...smsState.channels.values()][0].id}/test`,
      body: { mobile: NUMBER },
    });
    expect(await screen.findByText('Test message sent')).toBeInTheDocument();
    await dialogsClosed();
    // The number does not stay on the page.
    expect(document.body.textContent).not.toContain(NUMBER);
    form = await openTest(user);
    expect(
      await form.findByText(`Test messages left today: ${TEST_PER_DAY - 1}`),
    ).toBeInTheDocument();
    expect((form.getByRole('textbox', { name: 'Phone number' }) as HTMLInputElement).value).toBe(
      '',
    );
  });

  it('refuses an empty number before it sends anything', async () => {
    const { calls, user } = await load();
    const form = await openTest(user);
    await form.findByText(/Test messages left today/);
    await user.click(form.getByRole('button', { name: 'Send' }));
    expect(await form.findByText('Enter a phone number')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('sends one request when Send is pressed twice', async () => {
    const { calls, user } = await load();
    const form = await openTest(user);
    await form.findByText(/Test messages left today/);
    setText(form.getByRole('textbox', { name: 'Phone number' }), NUMBER);
    const gate = holdWrites();
    const send = form.getByRole('button', { name: 'Send' });
    fireEvent.click(send);
    fireEvent.click(send);
    await settled();
    expect(gate.started()).toBe(1);
    fireEvent.submit(document.querySelector('.ant-modal form') as Element);
    await settled();
    expect(gate.started()).toBe(1);
    gate.release();
    await settled();
    expect(writesOf(calls)).toHaveLength(1);
  });

  it('cannot be sent when none are left: the count says 0 and Send is disabled', async () => {
    backend();
    overrideFetch(async ({ method, url }) =>
      method === 'GET' && url.pathname === '/api/admin/sms/meta'
        ? jsonAnswer(200, '200', { providers: [], testRemainingToday: 0 })
        : undefined,
    );
    const user = userEvent.setup();
    renderPage(<ChannelsPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    const form = await openTest(user);
    expect(await form.findByText('Test messages left today: 0')).toBeInTheDocument();
    expect(form.getByText('No test messages are left today.')).toBeInTheDocument();
    expect(form.getByRole('button', { name: 'Send' })).toBeDisabled();
  });

  it('shows a count that cannot be negative or fractional, and a dash when the backend does not say', async () => {
    backend();
    let answer: unknown = { providers: [], testRemainingToday: -3 };
    overrideFetch(async ({ method, url }) =>
      method === 'GET' && url.pathname === '/api/admin/sms/meta'
        ? jsonAnswer(200, '200', answer)
        : undefined,
    );
    const user = userEvent.setup();
    renderPage(<ChannelsPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    let form = await openTest(user);
    expect(await form.findByText('Test messages left today: —')).toBeInTheDocument();
    await user.click(form.getByRole('button', { name: 'Cancel' }));
    await dialogsClosed();
    answer = { providers: [], testRemainingToday: 'many' };
    form = await openTest(user);
    expect(await form.findByText('Test messages left today: —')).toBeInTheDocument();
  });

  it('says in the words of the code that the day is used up when the backend refuses with 429, and reads the count again', async () => {
    backend();
    let left = 3;
    overrideFetch(async ({ method, url }) => {
      if (method === 'POST') {
        left = 0;
        return jsonAnswer(429, 'RATE_LIMITED', null, 'SECRET BACKEND WORDS');
      }
      if (method === 'GET' && url.pathname === '/api/admin/sms/meta') {
        return jsonAnswer(200, '200', { providers: [], testRemainingToday: left });
      }
      return undefined;
    });
    const user = userEvent.setup();
    renderPage(<ChannelsPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    const form = await openTest(user);
    await form.findByText('Test messages left today: 3');
    setText(form.getByRole('textbox', { name: 'Phone number' }), NUMBER);
    await user.click(form.getByRole('button', { name: 'Send' }));
    expect(await form.findByText('Too many requests. Please try again later.')).toBeInTheDocument();
    expect(await form.findByText('Test messages left today: 0')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('SECRET BACKEND WORDS');
  });

  it('says in the words of the code that the number is not valid, and keeps the dialog open', async () => {
    const { user } = await load();
    const form = await openTest(user);
    await form.findByText(/Test messages left today/);
    setText(form.getByRole('textbox', { name: 'Phone number' }), 'not a number');
    await user.click(form.getByRole('button', { name: 'Send' }));
    expect(await form.findByText('The phone number is not valid.')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('can still be sent when the count could not be read, and says that it could not', async () => {
    backend();
    overrideFetch(async ({ method, url }) =>
      method === 'GET' && url.pathname === '/api/admin/sms/meta'
        ? jsonAnswer(500, 'INTERNAL_ERROR', null, 'SECRET BACKEND WORDS')
        : undefined,
    );
    const user = userEvent.setup();
    renderPage(<ChannelsPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    const form = await openTest(user);
    expect(
      await form.findByText(/number of test messages left could not be read/),
    ).toBeInTheDocument();
    expect(form.getByRole('button', { name: 'Send' })).not.toBeDisabled();
    expect(document.body.textContent).not.toContain('SECRET BACKEND WORDS');
  });

  it('shows that the session has ended and does not send the write again', async () => {
    backend();
    const taken = overrideFetch(async ({ method }) =>
      method === 'POST'
        ? jsonAnswer(401, 'ADMIN_INVALID_TOKEN', null, 'SECRET BACKEND WORDS')
        : undefined,
    );
    const user = userEvent.setup();
    renderPage(<ChannelsPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    const form = await openTest(user);
    await form.findByText(/Test messages left today/);
    setText(form.getByRole('textbox', { name: 'Phone number' }), NUMBER);
    await user.click(form.getByRole('button', { name: 'Send' }));
    expect(
      await screen.findByText('Your session has expired. Please sign in again.'),
    ).toBeInTheDocument();
    await settled();
    expect(taken).toHaveLength(1);
  });
});
