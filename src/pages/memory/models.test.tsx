import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetConfigStore } from '../../../mock/_core/configStore';
import { memoryStore } from '../../../mock/_core/memoryData';
import * as configMock from '../../../mock/config.mock';
import * as memoryMock from '../../../mock/memory.mock';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import ModelsPage from './models';
import { signIn } from './testSetup';

const VIEW = ['MEMORY:VIEW'];
const REGISTER = ['MEMORY:VIEW', 'MEMORY:MODEL_REGISTER'];

beforeEach(() => {
  resetConfigStore();
  signIn('reviewer', REGISTER);
});
afterEach(() => vi.unstubAllGlobals());

const writes = (calls: ReturnType<typeof useMockBackend>) =>
  calls.filter((c) => c.method !== 'GET' && c.url.includes('embedding-models'));
const URL_OK = 'https://tei.internal.example/v2';

const openRegister = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('button', { name: 'Register a model' }));
  return screen.findByRole('dialog');
};
const fill = (
  dialog: HTMLElement,
  values: { name?: string; url?: string; dimensions?: string },
) => {
  fireEvent.change(within(dialog).getByLabelText('Model name'), {
    target: { value: values.name ?? 'e5-base' },
  });
  fireEvent.change(within(dialog).getByLabelText('TEI address'), {
    target: { value: values.url ?? URL_OK },
  });
  fireEvent.change(within(dialog).getByLabelText('Dimensions'), {
    target: { value: values.dimensions ?? '768' },
  });
};

describe('the model list', { timeout: 30000 }, () => {
  it('shows the registered models with their address and dimensions', async () => {
    useMockBackend(memoryMock, configMock);
    renderPage(<ModelsPage />);
    const row = (await screen.findByText('bge-m3', { selector: 'td' })).closest(
      'tr',
    ) as HTMLElement;
    expect(within(row).getByText('https://tei.internal.example')).toBeInTheDocument();
    expect(within(row).getByText('1024')).toBeInTheDocument();
  });

  it('shows no "Register a model" button and no parameters without MEMORY:MODEL_REGISTER', async () => {
    signIn('reviewer', VIEW);
    const calls = useMockBackend(memoryMock, configMock);
    renderPage(<ModelsPage />);
    await screen.findByText('bge-m3', { selector: 'td' });
    expect(screen.queryByRole('button', { name: 'Register a model' })).toBeNull();
    expect(screen.queryByText('Parameters')).toBeNull();
    expect(calls.some((c) => c.url === '/api/admin/config')).toBe(false);
  });

  it('has a parameters section with the keys of MEMORY:MODEL_REGISTER for an administrator who may register', async () => {
    useMockBackend(memoryMock, configMock);
    renderPage(<ModelsPage />);
    expect(await screen.findByText('Parameters')).toBeInTheDocument();
    expect(await screen.findByText('Allowed embedding hosts')).toBeInTheDocument();
  });
});

describe('registering a model', { timeout: 30000 }, () => {
  it('says to start the TEI container first', async () => {
    useMockBackend(memoryMock, configMock);
    const user = userEvent.setup();
    renderPage(<ModelsPage />);
    const dialog = await openRegister(user);
    expect(
      within(dialog).getByText('Start the TEI container first, then register the model.'),
    ).toBeInTheDocument();
  });

  it('sends the address and the dimensions with PUT and shows the model in the list', async () => {
    const calls = useMockBackend(memoryMock, configMock);
    const user = userEvent.setup();
    renderPage(<ModelsPage />);
    const dialog = await openRegister(user);
    fill(dialog, {});
    await user.click(within(dialog).getByRole('button', { name: 'Register' }));
    await screen.findByText('Model registered');
    expect(writes(calls)).toEqual([
      {
        method: 'PUT',
        url: '/api/admin/memory/embedding-models/e5-base',
        body: { teiBaseUrl: URL_OK, dimensions: 768 },
      },
    ]);
    expect(await screen.findByText('e5-base', { selector: 'td' })).toBeInTheDocument();
  });

  it('shows the detail of a 409 MEMORY_MODEL_CONFLICT as the memory service wrote it', async () => {
    useMockBackend(memoryMock, configMock);
    const user = userEvent.setup();
    renderPage(<ModelsPage />);
    const dialog = await openRegister(user);
    fill(dialog, { name: 'bge-m3', url: 'https://tei.internal.example', dimensions: '768' });
    await user.click(within(dialog).getByRole('button', { name: 'Register' }));
    expect(
      await within(dialog).findByText(
        'Model bge-m3 is already registered with 1024 dimensions; its vector table cannot change, register a new name instead',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(memoryStore.models.get('bge-m3')?.dimensions).toBe(1024);
  });

  it('shows the detail whatever it holds: Thai, Arabic and a long string with no space', async () => {
    const detail = `ไม่สามารถ مرحبا ${'z'.repeat(2000)}`;
    stubFetch(async ({ init }) =>
      (init.method ?? 'GET') === 'GET'
        ? jsonResponse(200, envelope('200', { items: [] }))
        : jsonResponse(409, envelope('MEMORY_MODEL_CONFLICT', { detail })),
    );
    const user = userEvent.setup();
    renderPage(<ModelsPage />);
    const dialog = await openRegister(user);
    fill(dialog, {});
    await user.click(within(dialog).getByRole('button', { name: 'Register' }));
    expect(await within(dialog).findByText(detail)).toBeInTheDocument();
  });

  it('shows the generic text of the code when a 409 has no detail', async () => {
    stubFetch(async ({ init }) =>
      (init.method ?? 'GET') === 'GET'
        ? jsonResponse(200, envelope('200', { items: [] }))
        : jsonResponse(409, envelope('MEMORY_MODEL_CONFLICT', null)),
    );
    const user = userEvent.setup();
    renderPage(<ModelsPage />);
    const dialog = await openRegister(user);
    fill(dialog, {});
    await user.click(within(dialog).getByRole('button', { name: 'Register' }));
    expect(
      await within(dialog).findByText(/registered with a different dimension/),
    ).toBeInTheDocument();
  });

  it.each([
    ['not http', 'ftp://tei.internal.example', '768'],
    ['not an address', 'tei.internal.example', '768'],
    ['with a user name', 'https://user:pw@tei.internal.example', '768'],
    ['dimensions 0', URL_OK, '0'],
    ['dimensions 8193', URL_OK, '8193'],
    ['dimensions with a fraction', URL_OK, '1.5'],
    ['no dimensions', URL_OK, ''],
  ])('refuses %s without sending', async (_label, url, dimensions) => {
    const calls = useMockBackend(memoryMock, configMock);
    const user = userEvent.setup();
    renderPage(<ModelsPage />);
    const dialog = await openRegister(user);
    fill(dialog, { url, dimensions });
    await user.click(within(dialog).getByRole('button', { name: 'Register' }));
    await waitFor(() =>
      expect(dialog.querySelector('.ant-form-item-explain-error')).not.toBeNull(),
    );
    expect(writes(calls)).toHaveLength(0);
  });

  it('refuses a model name with a space, a dot or letters of another script, without sending', async () => {
    const calls = useMockBackend(memoryMock, configMock);
    const user = userEvent.setup();
    renderPage(<ModelsPage />);
    const dialog = await openRegister(user);
    for (const name of ['e5 base', 'e5.base', 'โมเดล']) {
      fill(dialog, { name });
      await user.click(within(dialog).getByRole('button', { name: 'Register' }));
      expect(await within(dialog).findByText(/The model name may use letters/)).toBeInTheDocument();
    }
    expect(writes(calls)).toHaveLength(0);
  });

  it('shows the reason under the address when the backend refuses the host', async () => {
    useMockBackend(memoryMock, configMock);
    const user = userEvent.setup();
    renderPage(<ModelsPage />);
    const dialog = await openRegister(user);
    fill(dialog, { url: 'https://elsewhere.example' });
    await user.click(within(dialog).getByRole('button', { name: 'Register' }));
    expect(await within(dialog).findByText(/The host is not valid/)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('sends once when the button is pressed twice', async () => {
    const calls = useMockBackend(memoryMock, configMock);
    const user = userEvent.setup();
    renderPage(<ModelsPage />);
    const dialog = await openRegister(user);
    fill(dialog, {});
    const button = within(dialog).getByRole('button', { name: 'Register' });
    fireEvent.click(button);
    fireEvent.click(button);
    await new Promise((r) => setTimeout(r, 200));
    expect(writes(calls)).toHaveLength(1);
  });

  it('does not send the write again when the token ended during it', async () => {
    const calls = stubFetch(async ({ init }) =>
      (init.method ?? 'GET') === 'GET'
        ? jsonResponse(200, envelope('200', { items: [] }))
        : jsonResponse(401, envelope('ADMIN_INVALID_TOKEN')),
    );
    const user = userEvent.setup();
    renderPage(<ModelsPage />);
    const dialog = await openRegister(user);
    fill(dialog, {});
    await user.click(within(dialog).getByRole('button', { name: 'Register' }));
    await waitFor(() => expect(calls.filter((c) => c.init.method === 'PUT')).toHaveLength(1));
    await new Promise((r) => setTimeout(r, 100));
    expect(calls.filter((c) => c.init.method === 'PUT')).toHaveLength(1);
  });
});
