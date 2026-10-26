import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryStore } from '../../../mock/_core/memoryData';
import * as memoryMock from '../../../mock/memory.mock';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import { signIn } from './testSetup';
import TiersPage from './tiers';

const VIEW = ['MEMORY:VIEW'];
const WRITE = ['MEMORY:VIEW', 'MEMORY:TIER_CONFIG'];

beforeEach(() => signIn('reviewer', WRITE));
afterEach(() => vi.unstubAllGlobals());

const rowOf = async (name: string) => {
  const row = (await screen.findByText(name, { selector: 'td' })).closest('tr');
  if (!row) throw new Error('no row');
  return row as HTMLTableRowElement;
};
const writes = (calls: ReturnType<typeof useMockBackend>) =>
  calls.filter((c) => c.method !== 'GET');
const lastDialog = () => screen.getAllByRole('dialog').at(-1) as HTMLElement;
const IMPACT = 'A change takes effect at once for every account on this tier.';

describe('the tier list', { timeout: 30000 }, () => {
  it('shows every tier with its five settings', async () => {
    useMockBackend(memoryMock);
    renderPage(<TiersPage />);
    const premium = await rowOf('premium');
    const cells = within(premium).getAllByRole('cell');
    expect(cells.map((c) => c.textContent)).toEqual(
      expect.arrayContaining(['premium', '10', 'Yes', '5', '500']),
    );
    const standard = await rowOf('default');
    expect(within(standard).getByText('No')).toBeInTheDocument();
  });

  it('shows neither "Edit" nor "New tier" without MEMORY:TIER_CONFIG', async () => {
    signIn('reviewer', VIEW);
    useMockBackend(memoryMock);
    renderPage(<TiersPage />);
    await rowOf('premium');
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'New tier' })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Details' }).length).toBe(2);
  });

  it('shows the edit and the new tier buttons to MEMORY:TIER_CONFIG', async () => {
    useMockBackend(memoryMock);
    renderPage(<TiersPage />);
    await rowOf('premium');
    expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'New tier' })).toBeInTheDocument();
  });

  it('shows the details of a tier in a drawer, read from the tier itself', async () => {
    const calls = useMockBackend(memoryMock);
    const user = userEvent.setup();
    renderPage(<TiersPage />);
    await user.click(within(await rowOf('premium')).getByRole('button', { name: 'Details' }));
    const drawer = await screen.findByRole('dialog');
    expect(await within(drawer).findByText('Tier premium')).toBeInTheDocument();
    expect(within(drawer).getByText('500')).toBeInTheDocument();
    expect(calls.some((c) => c.url === '/api/admin/memory/tiers/premium')).toBe(true);
  });

  it('shows a failed load with a retry and does not break', async () => {
    stubFetch(async () => jsonResponse(502, envelope('MEMORY_SERVICE_ERROR')));
    renderPage(<TiersPage />);
    expect(await screen.findByText(/The memory service is not available/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});

describe('editing a tier', { timeout: 30000 }, () => {
  const openEdit = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
    await user.click(within(await rowOf(name)).getByRole('button', { name: 'Edit' }));
    return screen.findByRole('dialog');
  };
  /** Waits for the values of the tier to be in the form, then changes the topK, so that there is something to save. */
  const changeTopK = async (dialog: HTMLElement, value: string) => {
    const topK = await within(dialog).findByLabelText('Results (topK)');
    await waitFor(() => expect(topK).toHaveValue('10'));
    fireEvent.change(topK, { target: { value } });
  };

  it('says on top that the change reaches every account on the tier, and shows the values now in force', async () => {
    const calls = useMockBackend(memoryMock);
    const user = userEvent.setup();
    renderPage(<TiersPage />);
    const dialog = await openEdit(user, 'premium');
    expect(within(dialog).getByText('Edit tier premium')).toBeInTheDocument();
    expect(within(dialog).getByText(IMPACT)).toBeInTheDocument();
    await waitFor(() => expect(within(dialog).getByLabelText('Results (topK)')).toHaveValue('10'));
    expect(within(dialog).getByLabelText('Consolidation threshold')).toHaveValue('500');
    expect(within(dialog).getByRole('switch', { name: 'Consolidation' })).toBeChecked();
    expect(calls.some((c) => c.url === '/api/admin/memory/tiers/premium')).toBe(true);
    // the name of an existing tier cannot be changed
    expect(within(dialog).queryByLabelText('Tier name')).toBeNull();
  });

  it('saves only the settings that were changed with PUT, without asking to create, and shows the new value', async () => {
    const calls = useMockBackend(memoryMock);
    const user = userEvent.setup();
    renderPage(<TiersPage />);
    const dialog = await openEdit(user, 'premium');
    await changeTopK(dialog, '12');
    await user.click(within(dialog).getByRole('switch', { name: 'Consolidation' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await screen.findByText('Tier saved');
    expect(writes(calls)).toEqual([
      {
        method: 'PUT',
        url: '/api/admin/memory/tiers/premium',
        body: { topK: 12, consolidationEnabled: false },
      },
    ]);
    expect(memoryStore.tiers.get('premium')?.topK).toBe(12);
    expect(within(await rowOf('premium')).getByText('12')).toBeInTheDocument();
  });

  it('does not overwrite a setting that another administrator changed meanwhile and this one left alone', async () => {
    const calls = useMockBackend(memoryMock);
    const user = userEvent.setup();
    renderPage(<TiersPage />);
    const dialog = await openEdit(user, 'premium');
    await changeTopK(dialog, '12');
    const other = memoryStore.tiers.get('premium');
    if (other) other.consolidationThreshold = 900; // someone else, after the dialog was opened
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await screen.findByText('Tier saved');
    expect(writes(calls)[0].body).toEqual({ topK: 12 });
    expect(memoryStore.tiers.get('premium')?.consolidationThreshold).toBe(900);
  });

  it('says nothing changed, and sends nothing, when the form is saved as it was read', async () => {
    const calls = useMockBackend(memoryMock);
    const user = userEvent.setup();
    renderPage(<TiersPage />);
    const dialog = await openEdit(user, 'premium');
    await waitFor(() => expect(within(dialog).getByLabelText('Results (topK)')).toHaveValue('10'));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Nothing changed')).toBeInTheDocument();
    expect(writes(calls)).toHaveLength(0);
  });

  it('refuses a setting out of range or not a whole number, without sending', async () => {
    const calls = useMockBackend(memoryMock);
    const user = userEvent.setup();
    renderPage(<TiersPage />);
    const dialog = await openEdit(user, 'premium');
    const topK = await within(dialog).findByLabelText('Results (topK)');
    await waitFor(() => expect(topK).toHaveValue('10'));
    for (const bad of ['0', '101', '']) {
      fireEvent.change(topK, { target: { value: bad } });
      await user.click(within(dialog).getByRole('button', { name: 'Save' }));
      expect(
        await within(dialog).findByText('Enter a whole number from 1 to 100'),
      ).toBeInTheDocument();
    }
    expect(writes(calls)).toHaveLength(0);
  });

  it('shows what the backend said when it refuses, and keeps the dialog open', async () => {
    const calls = useMockBackend(memoryMock);
    memoryStore.serviceDown = true;
    const user = userEvent.setup();
    renderPage(<TiersPage />);
    const dialog = await openEdit(user, 'premium');
    await changeTopK(dialog, '12');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(
      await within(dialog).findByText('The memory service is not available.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(writes(calls)).toHaveLength(1);
  });

  it('sends once when the save button is pressed twice', async () => {
    const calls = useMockBackend(memoryMock);
    const user = userEvent.setup();
    renderPage(<TiersPage />);
    const dialog = await openEdit(user, 'premium');
    await changeTopK(dialog, '12');
    const save = within(dialog).getByRole('button', { name: 'Save' });
    fireEvent.click(save);
    fireEvent.click(save);
    await new Promise((r) => setTimeout(r, 200));
    expect(writes(calls)).toHaveLength(1);
  });

  it('does not send the write again when the token ended during it', async () => {
    const tier = {
      tierName: 'premium',
      topK: 10,
      recencyChannelEnabled: true,
      recencyChannelCount: 5,
      consolidationEnabled: true,
      consolidationThreshold: 500,
    };
    const calls = stubFetch(async ({ url, init }) => {
      if ((init.method ?? 'GET') === 'PUT')
        return jsonResponse(401, envelope('ADMIN_INVALID_TOKEN'));
      return jsonResponse(200, envelope('200', url.endsWith('/tiers') ? { items: [tier] } : tier));
    });
    const user = userEvent.setup();
    renderPage(<TiersPage />);
    const dialog = await openEdit(user, 'premium');
    await changeTopK(dialog, '12');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(calls.filter((c) => c.init.method === 'PUT')).toHaveLength(1));
    await new Promise((r) => setTimeout(r, 100));
    expect(calls.filter((c) => c.init.method === 'PUT')).toHaveLength(1);
  });
});

describe('a new tier', { timeout: 30000 }, () => {
  const openNew = async (user: ReturnType<typeof userEvent.setup>) => {
    await rowOf('premium');
    await user.click(screen.getByRole('button', { name: 'New tier' }));
    return screen.findByRole('dialog');
  };

  it('asks to confirm "a new tier X will be created" before it sends a name that is not in the list', async () => {
    const calls = useMockBackend(memoryMock);
    const user = userEvent.setup();
    renderPage(<TiersPage />);
    const dialog = await openNew(user);
    expect(within(dialog).getByText(IMPACT)).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('Tier name'), { target: { value: 'gold' } });
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect((await screen.findAllByText(/A new tier gold will be created/)).length).toBeGreaterThan(
      0,
    );
    expect(writes(calls)).toHaveLength(0);
    // no: nothing is sent
    await user.click(within(lastDialog()).getByRole('button', { name: 'Cancel' }));
    await new Promise((r) => setTimeout(r, 150));
    expect(writes(calls)).toHaveLength(0);
    // yes: it is created
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await screen.findAllByText(/A new tier gold will be created/);
    await user.click(within(lastDialog()).getByRole('button', { name: 'OK' }));
    await screen.findByText('Tier created');
    expect(writes(calls).map((c) => c.url)).toEqual(['/api/admin/memory/tiers/gold']);
    expect(memoryStore.tiers.has('gold')).toBe(true);
    expect(await rowOf('gold')).toBeInTheDocument();
  });

  it('asks before the new-tier form replaces a tier that already exists, and sends nothing when refused', async () => {
    const calls = useMockBackend(memoryMock);
    const user = userEvent.setup();
    renderPage(<TiersPage />);
    const dialog = await openNew(user);
    const before = JSON.stringify(memoryStore.tiers.get('premium'));
    fireEvent.change(within(dialog).getByLabelText('Tier name'), { target: { value: 'premium' } });
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await screen.findAllByText(/Tier premium already exists/);
    expect(screen.queryAllByText(/will be created/)).toHaveLength(0);
    expect(writes(calls)).toHaveLength(0);
    await user.click(within(lastDialog()).getByRole('button', { name: 'Cancel' }));
    await new Promise((r) => setTimeout(r, 150));
    expect(writes(calls)).toHaveLength(0);
    expect(JSON.stringify(memoryStore.tiers.get('premium'))).toBe(before);
  });

  it('replaces the existing tier with all five settings once the person confirms', async () => {
    const calls = useMockBackend(memoryMock);
    const user = userEvent.setup();
    renderPage(<TiersPage />);
    const dialog = await openNew(user);
    fireEvent.change(within(dialog).getByLabelText('Tier name'), { target: { value: 'premium' } });
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await screen.findAllByText(/Tier premium already exists/);
    await user.click(within(lastDialog()).getByRole('button', { name: 'OK' }));
    await screen.findByText('Tier saved');
    expect(writes(calls)).toHaveLength(1);
    expect(Object.keys(writes(calls)[0].body as object).sort()).toEqual([
      'consolidationEnabled',
      'consolidationThreshold',
      'recencyChannelCount',
      'recencyChannelEnabled',
      'topK',
    ]);
  });

  it('starts from the values of the default tier', async () => {
    useMockBackend(memoryMock);
    const user = userEvent.setup();
    renderPage(<TiersPage />);
    const dialog = await openNew(user);
    expect(within(dialog).getByLabelText('Results (topK)')).toHaveValue('5');
    expect(within(dialog).getByLabelText('Consolidation threshold')).toHaveValue('200');
  });

  it.each([
    ['empty', ''],
    ['a space', 'my tier'],
    ['a dot', 'a.b'],
    ['Thai', 'ระดับ'],
    ['Arabic', 'مستوى'],
    ['65 characters', 'a'.repeat(65)],
  ])('refuses a name that is %s, without asking and without sending', async (_label, name) => {
    const calls = useMockBackend(memoryMock);
    const user = userEvent.setup();
    renderPage(<TiersPage />);
    const dialog = await openNew(user);
    fireEvent.change(within(dialog).getByLabelText('Tier name'), { target: { value: name } });
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(
      await within(dialog).findByText(
        /The tier name may use letters, digits, underscore and hyphen only/,
      ),
    ).toBeInTheDocument();
    expect(screen.queryAllByText(/will be created/)).toHaveLength(0);
    expect(writes(calls)).toHaveLength(0);
  });

  it('keeps the whole name when it is 64 characters, and sends it', async () => {
    const calls = useMockBackend(memoryMock);
    const user = userEvent.setup();
    renderPage(<TiersPage />);
    const dialog = await openNew(user);
    const name = 'a'.repeat(64);
    fireEvent.change(within(dialog).getByLabelText('Tier name'), { target: { value: name } });
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await screen.findAllByText(/will be created/);
    await user.click(within(lastDialog()).getByRole('button', { name: 'OK' }));
    await screen.findByText('Tier created');
    expect(writes(calls)[0].url).toBe(`/api/admin/memory/tiers/${name}`);
  });
});
