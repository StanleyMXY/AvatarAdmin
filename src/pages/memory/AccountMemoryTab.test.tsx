import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MEMORY_ACCOUNT_IDS, memoryStore } from '../../../mock/_core/memoryData';
import * as memoryMock from '../../../mock/memory.mock';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import AccountMemoryTab from './AccountMemoryTab';
import { signIn } from './testSetup';

const VIEW = ['MEMORY:VIEW'];
const ASSIGN = ['MEMORY:VIEW', 'MEMORY:MODEL_ASSIGN'];

beforeEach(() => signIn('reviewer', ASSIGN));
afterEach(() => vi.unstubAllGlobals());

const WARNING = /Switching the model only affects new writes/;
const writes = (calls: ReturnType<typeof useMockBackend>) =>
  calls.filter((c) => c.method !== 'GET');

const chooseModel = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  await user.click(await screen.findByRole('combobox', { name: 'Choose a model' }));
  const options = await screen.findAllByText(name, { selector: '.ant-select-item-option-content' });
  await user.click(options[options.length - 1]);
};

describe('what the tab shows', { timeout: 30000 }, () => {
  it('shows the tier, how it is synced, when, and the history of model assignments with the name of the administrator', async () => {
    useMockBackend(memoryMock);
    renderPage(<AccountMemoryTab accountId={MEMORY_ACCOUNT_IDS.active} accountStatus="ACTIVE" />);
    expect(await screen.findByText('premium')).toBeInTheDocument();
    expect(screen.getByText('Synced')).toBeInTheDocument();
    const history = screen.getByTestId('assignment-history');
    expect(within(history).getByText('bge-m3')).toBeInTheDocument();
    expect(within(history).getByText('root')).toBeInTheDocument();
    expect(screen.getByText('Current model: bge-m3')).toBeInTheDocument();
  });

  it('shows the error of a failed sync, and the first 8 characters of the ID when the administrator is gone', async () => {
    useMockBackend(memoryMock);
    renderPage(
      <AccountMemoryTab accountId={MEMORY_ACCOUNT_IDS.failedSync} accountStatus="ACTIVE" />,
    );
    expect(await screen.findByText('Sync failed')).toBeInTheDocument();
    expect(screen.getByText(/tier premium not found/)).toBeInTheDocument();
    expect(within(screen.getByTestId('assignment-history')).getByText('9999')).toBeInTheDocument();
  });

  it('says so when no tier was ever assigned and there is no assignment: the default tier and the default model apply', async () => {
    useMockBackend(memoryMock);
    renderPage(<AccountMemoryTab accountId={MEMORY_ACCOUNT_IDS.banned} accountStatus="BANNED" />);
    expect(await screen.findByText(/No tier has been assigned yet/)).toBeInTheDocument();
    expect(
      screen.getByText('No assignment yet; the default model bge-m3 is used'),
    ).toBeInTheDocument();
  });

  it('says that only the newest are shown, how many, and how many there are, when the history is cut', async () => {
    useMockBackend(memoryMock);
    renderPage(
      <AccountMemoryTab accountId={MEMORY_ACCOUNT_IDS.manyAssignments} accountStatus="ACTIVE" />,
    );
    const total =
      memoryStore.accounts.get(MEMORY_ACCOUNT_IDS.manyAssignments)?.assignments.length ?? 0;
    expect(
      await screen.findByText(`Only the newest 200 are shown, ${total} in total.`),
    ).toBeInTheDocument();
    expect(within(screen.getByTestId('assignment-history')).getAllByRole('row').length).toBe(201);
  });

  it('says it in Chinese', async () => {
    useMockBackend(memoryMock);
    renderPage(
      <AccountMemoryTab accountId={MEMORY_ACCOUNT_IDS.manyAssignments} accountStatus="ACTIVE" />,
      'zh-CN',
    );
    const total =
      memoryStore.accounts.get(MEMORY_ACCOUNT_IDS.manyAssignments)?.assignments.length ?? 0;
    expect(await screen.findByText(`只显示最新 200 条，共 ${total} 条。`)).toBeInTheDocument();
  });

  it('says nothing about it when the history is whole, and when the backend sent neither field', async () => {
    useMockBackend(memoryMock);
    const first = renderPage(
      <AccountMemoryTab accountId={MEMORY_ACCOUNT_IDS.active} accountStatus="ACTIVE" />,
    );
    await screen.findByText('premium');
    expect(screen.queryByText(/Only the newest/)).toBeNull();
    first.unmount();
    vi.unstubAllGlobals();
    stubFetch(async ({ url }) =>
      jsonResponse(
        200,
        envelope(
          '200',
          url.endsWith('/memory')
            ? {
                tier: {
                  tierName: 'default',
                  syncStatus: 'SYNCED',
                  assignedAt: null,
                  lastError: null,
                },
                embeddingAssignments: [],
              }
            : { items: [] },
        ),
      ),
    );
    renderPage(<AccountMemoryTab accountId="2001" accountStatus="ACTIVE" />);
    await screen.findByText('default');
    expect(screen.queryByText(/Only the newest/)).toBeNull();
  });

  it('still says the history is cut when the backend sends truncated but no total, without a made up number', async () => {
    stubFetch(async ({ url }) =>
      jsonResponse(
        200,
        envelope(
          '200',
          url.endsWith('/memory')
            ? {
                tier: {
                  tierName: 'default',
                  syncStatus: 'SYNCED',
                  assignedAt: null,
                  lastError: null,
                },
                embeddingAssignments: [
                  {
                    modelName: 'bge-m3',
                    assignedBy: '1',
                    assignedByUsername: 'root',
                    assignedAt: '2026-10-01T00:00:00.000Z',
                  },
                ],
                truncated: true,
              }
            : { items: [] },
        ),
      ),
    );
    renderPage(<AccountMemoryTab accountId="2001" accountStatus="ACTIVE" />);
    expect(await screen.findByText('Only the newest 1 are shown.')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/NaN|undefined|null/);
  });

  it('says that the tier cannot be assigned by hand', async () => {
    useMockBackend(memoryMock);
    renderPage(<AccountMemoryTab accountId={MEMORY_ACCOUNT_IDS.active} accountStatus="ACTIVE" />);
    expect(await screen.findByText(/cannot be assigned by hand/)).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Tier' })).toBeNull();
  });

  it('shows the failure, not a blank, when the account is not found', async () => {
    useMockBackend(memoryMock);
    renderPage(<AccountMemoryTab accountId="424242" accountStatus="ACTIVE" />);
    expect(await screen.findByText(/The item was not found/)).toBeInTheDocument();
  });
});

describe('assigning a model', { timeout: 30000 }, () => {
  it('has no assign controls without MEMORY:MODEL_ASSIGN', async () => {
    signIn('reviewer', VIEW);
    useMockBackend(memoryMock);
    renderPage(<AccountMemoryTab accountId={MEMORY_ACCOUNT_IDS.active} accountStatus="ACTIVE" />);
    await screen.findByText('premium');
    expect(screen.queryByRole('button', { name: 'Assign model' })).toBeNull();
    expect(screen.queryByText(WARNING)).toBeNull();
  });

  it('warns that only new writes are affected and that old memories will most likely not be found', async () => {
    useMockBackend(memoryMock);
    renderPage(<AccountMemoryTab accountId={MEMORY_ACCOUNT_IDS.active} accountStatus="ACTIVE" />);
    const warning = await screen.findByText(WARNING);
    expect(warning.textContent).toMatch(/old memories will most likely not be found/);
  });

  it('asks again with the warning, then sends the model with PUT and shows it in the history', async () => {
    memoryStore.models.set('e5-base', {
      modelName: 'e5-base',
      teiBaseUrl: 'https://tei.internal.example',
      dimensions: 768,
    });
    const calls = useMockBackend(memoryMock);
    const user = userEvent.setup();
    renderPage(<AccountMemoryTab accountId={MEMORY_ACCOUNT_IDS.active} accountStatus="ACTIVE" />);
    await chooseModel(user, 'e5-base');
    await user.click(screen.getByRole('button', { name: 'Assign model' }));
    expect(
      await screen.findByText(/Change the embedding model of this account to e5-base/),
    ).toBeInTheDocument();
    expect(writes(calls)).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'OK' }));
    await screen.findByText('Model assigned');
    expect(writes(calls)).toEqual([
      {
        method: 'PUT',
        url: `/api/admin/accounts/${MEMORY_ACCOUNT_IDS.active}/memory/embedding-model`,
        body: { modelName: 'e5-base' },
      },
    ]);
    await waitFor(() => expect(screen.getByText('Current model: e5-base')).toBeInTheDocument());
  });

  it('does not send when the question is cancelled, and needs a model chosen first', async () => {
    const calls = useMockBackend(memoryMock);
    const user = userEvent.setup();
    renderPage(<AccountMemoryTab accountId={MEMORY_ACCOUNT_IDS.active} accountStatus="ACTIVE" />);
    const button = await screen.findByRole('button', { name: 'Assign model' });
    expect(button).toBeDisabled();
    await chooseModel(user, 'bge-m3');
    await user.click(screen.getByRole('button', { name: 'Assign model' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    await new Promise((r) => setTimeout(r, 100));
    expect(writes(calls)).toHaveLength(0);
  });

  it.each([
    ['waiting for deletion', 'PENDING_DELETION', MEMORY_ACCOUNT_IDS.pendingDeletion],
    ['being deleted', 'DELETING', MEMORY_ACCOUNT_IDS.deleting],
  ])('disables the button and says why when the account is %s', async (_label, status, id) => {
    const calls = useMockBackend(memoryMock);
    renderPage(<AccountMemoryTab accountId={id} accountStatus={status} />);
    await screen.findByText('Synced');
    expect(screen.getByRole('button', { name: 'Assign model' })).toBeDisabled();
    expect(screen.getByText(/waiting for deletion or being deleted/)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Choose a model' })).toBeDisabled();
    expect(writes(calls)).toHaveLength(0);
  });

  it('keeps the button usable for an account that is banned', async () => {
    useMockBackend(memoryMock);
    const user = userEvent.setup();
    renderPage(<AccountMemoryTab accountId={MEMORY_ACCOUNT_IDS.banned} accountStatus="BANNED" />);
    await chooseModel(user, 'bge-m3');
    expect(screen.getByRole('button', { name: 'Assign model' })).toBeEnabled();
  });

  it('shows the refusal of the backend when it says the account is being deleted after all', async () => {
    useMockBackend(memoryMock);
    const account = memoryStore.accounts.get(MEMORY_ACCOUNT_IDS.active);
    if (account) account.status = 'DELETING';
    const user = userEvent.setup();
    renderPage(<AccountMemoryTab accountId={MEMORY_ACCOUNT_IDS.active} accountStatus="ACTIVE" />);
    await chooseModel(user, 'bge-m3');
    await user.click(screen.getByRole('button', { name: 'Assign model' }));
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    expect(await screen.findByText('The account is being deleted.')).toBeInTheDocument();
  });

  it('sends once when OK is pressed twice', async () => {
    const calls = useMockBackend(memoryMock);
    const user = userEvent.setup();
    renderPage(<AccountMemoryTab accountId={MEMORY_ACCOUNT_IDS.active} accountStatus="ACTIVE" />);
    await chooseModel(user, 'bge-m3');
    await user.click(screen.getByRole('button', { name: 'Assign model' }));
    const ok = await screen.findByRole('button', { name: 'OK' });
    ok.click();
    ok.click();
    await new Promise((r) => setTimeout(r, 200));
    expect(writes(calls)).toHaveLength(1);
  });

  it('does not send the write again when the token ended during it', async () => {
    const calls = stubFetch(async ({ url, init }) => {
      if ((init.method ?? 'GET') === 'PUT')
        return jsonResponse(401, envelope('ADMIN_INVALID_TOKEN'));
      return jsonResponse(
        200,
        envelope(
          '200',
          url.endsWith('/memory')
            ? {
                tier: {
                  tierName: 'default',
                  syncStatus: 'SYNCED',
                  assignedAt: null,
                  lastError: null,
                },
                embeddingAssignments: [],
              }
            : {
                items: [
                  {
                    modelName: 'bge-m3',
                    teiBaseUrl: 'https://tei.internal.example',
                    dimensions: 1024,
                  },
                ],
              },
        ),
      );
    });
    const user = userEvent.setup();
    renderPage(<AccountMemoryTab accountId="2001" accountStatus="ACTIVE" />);
    await chooseModel(user, 'bge-m3');
    await user.click(screen.getByRole('button', { name: 'Assign model' }));
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    await waitFor(() => expect(calls.filter((c) => c.init.method === 'PUT')).toHaveLength(1));
    await new Promise((r) => setTimeout(r, 100));
    expect(calls.filter((c) => c.init.method === 'PUT')).toHaveLength(1);
  });
});
