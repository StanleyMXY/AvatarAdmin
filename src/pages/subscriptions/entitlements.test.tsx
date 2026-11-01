import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetStore } from '../../../mock/_core/store';
import { resetSubscriptionsStore, subscriptionsState } from '../../../mock/_core/subscriptionsData';
import * as subscriptionsMock from '../../../mock/subscriptions.mock';
import { holdRequests } from '../../../tests/heldRequests';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { signInAs, useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import { resetUmiStub, setTestAccess } from '../../../tests/stubs/umi-max';
import access from '../../access';
import EntitlementsPage from './entitlements';

const as = (permissions: string[], superAdmin = false) =>
  setTestAccess(access({ me: { superAdmin, permissions } }) as unknown as Record<string, unknown>);

beforeEach(() => {
  resetUmiStub();
  resetStore();
  resetSubscriptionsStore();
  signInAs('root');
  as([], true);
});
afterEach(() => vi.unstubAllGlobals());

const CALL_WARNING =
  'Subscribers with this entitlement are not limited by a daily or monthly call quota.';
const CHAT_WARNING =
  'Subscribers with this entitlement are not limited by a daily or monthly text quota.';
const writes = <T extends { method: string }>(calls: T[]) =>
  calls.filter((c) => c.method !== 'GET');

const rowOf = async (key: string) => {
  const cell = await screen.findByText(key, { selector: 'code' });
  return cell.closest('tr') as HTMLElement;
};

const openFeatures = async (key: string) => {
  const user = userEvent.setup();
  const row = await rowOf(key);
  await user.click(within(row).getByRole('button', { name: 'Feature values' }));
  const drawer = await screen.findByRole('dialog');
  await within(drawer).findByTestId('feature-row-assets.avatar_max');
  return { user, drawer };
};
const featureRow = (drawer: HTMLElement, key: string) =>
  within(drawer).getByTestId(`feature-row-${key}`);
const picked = (row: HTMLElement) =>
  within(row)
    .getAllByRole('radio')
    .filter((r) => (r as HTMLInputElement).checked)
    .map((r) => r.closest('label')?.textContent);

describe('the list of entitlements', { timeout: 30000 }, () => {
  it('shows key, name and priority by priority, with names in any language', async () => {
    useMockBackend(subscriptionsMock);
    renderPage(<EntitlementsPage />);
    await rowOf('premium');
    const keys = [...document.querySelectorAll('tbody tr.ant-table-row code')].map(
      (c) => c.textContent,
    );
    expect(keys).toEqual(['basic', 'premium', 'plus_th', 'vip_ar']);
    expect(screen.getByText(/Hola, ¿cómo estás hoy\?/)).toBeInTheDocument();
    expect(within(await rowOf('plus_th')).getByText(/ภาษาไทยไม่มีช่องว่าง/)).toBeInTheDocument();
    expect(within(await rowOf('vip_ar')).getByText('40')).toBeInTheDocument();
  });

  it('keeps a name of 5000 characters without spaces inside its cell', async () => {
    subscriptionsState().defs[0].name = 'ก'.repeat(5000);
    useMockBackend(subscriptionsMock);
    renderPage(<EntitlementsPage />);
    await rowOf('basic');
    const clamp = document.querySelector('tbody button[data-lines]') as HTMLElement;
    expect(clamp.style.overflowWrap).toBe('anywhere');
  });

  it('shows a failed read with a retry', async () => {
    stubFetch(async () => jsonResponse(503, envelope('DEPENDENCY_UNAVAILABLE')));
    renderPage(<EntitlementsPage />);
    expect(await screen.findByText(/Failed to load/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});

describe('the feature values of an entitlement', { timeout: 30000 }, () => {
  it('has one row for each switch except call.lifetime_minutes, which never appears', async () => {
    useMockBackend(subscriptionsMock);
    renderPage(<EntitlementsPage />);
    const { drawer } = await openFeatures('premium');
    const rows = within(drawer).getAllByTestId(/^feature-row-/);
    expect(rows).toHaveLength(14);
    expect(within(drawer).queryByTestId('feature-row-call.lifetime_minutes')).toBeNull();
    expect(within(drawer).queryByText('call.lifetime_minutes')).toBeNull();
    const keys = rows.map((r) =>
      (r.getAttribute('data-testid') as string).replace('feature-row-', ''),
    );
    expect(keys).toEqual([...keys].sort());
  });

  it('shows the three states of the saved values: a value, "No limit" and "Not configured"', async () => {
    useMockBackend(subscriptionsMock);
    renderPage(<EntitlementsPage />);
    const { drawer } = await openFeatures('premium');
    expect(picked(featureRow(drawer, 'assets.avatar_max'))).toEqual(['Value']);
    expect(within(featureRow(drawer, 'assets.avatar_max')).getByRole('spinbutton')).toHaveValue(
      '10',
    );
    expect(picked(featureRow(drawer, 'assets.voice_max'))).toEqual(['No limit']);
    expect(picked(featureRow(drawer, 'call.daily_minutes'))).toEqual(['Not configured']);
    expect(within(featureRow(drawer, 'chat.model_tier')).getByRole('textbox')).toHaveValue(
      'premium',
    );
    expect(within(featureRow(drawer, 'ads.removed')).getByRole('switch')).toBeChecked();
  });

  it('can leave any switch not configured, and offers "No limit" only for a limit other than credits.period_grant', async () => {
    useMockBackend(subscriptionsMock);
    renderPage(<EntitlementsPage />);
    const { drawer } = await openFeatures('basic');
    for (const row of within(drawer).getAllByTestId(/^feature-row-/)) {
      expect(within(row).getByText('Not configured')).toBeInTheDocument();
    }
    expect(within(featureRow(drawer, 'credits.period_grant')).queryByText('No limit')).toBeNull();
    expect(within(featureRow(drawer, 'ads.removed')).queryByText('No limit')).toBeNull();
    expect(within(featureRow(drawer, 'memory.tier')).queryByText('No limit')).toBeNull();
    expect(
      within(featureRow(drawer, 'avatar.looks_max')).getByText('No limit'),
    ).toBeInTheDocument();
    expect(
      within(featureRow(drawer, 'assets.avatar_max')).getByText('No limit'),
    ).toBeInTheDocument();
  });

  it('saves only the switches that changed, each in the shape of its state', async () => {
    const calls = useMockBackend(subscriptionsMock);
    renderPage(<EntitlementsPage />);
    const { user, drawer } = await openFeatures('basic');
    await user.click(within(featureRow(drawer, 'assets.avatar_max')).getByText('Value'));
    fireEvent.change(within(featureRow(drawer, 'assets.avatar_max')).getByRole('spinbutton'), {
      target: { value: '4' },
    });
    await user.click(within(featureRow(drawer, 'assets.voice_max')).getByText('No limit'));
    await user.click(within(featureRow(drawer, 'ads.removed')).getByText('Value'));
    await user.click(within(featureRow(drawer, 'ads.removed')).getByRole('switch'));
    await user.click(within(drawer).getByRole('button', { name: /Save/ }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(writes(calls)[0].method).toBe('PUT');
    expect(writes(calls)[0].url).toBe('/api/admin/entitlement-defs/basic/features');
    expect(writes(calls)[0].body).toEqual({
      features: [
        { featureKey: 'ads.removed', mode: 'VALUE', value: true },
        { featureKey: 'assets.avatar_max', mode: 'VALUE', value: 4 },
        { featureKey: 'assets.voice_max', mode: 'UNLIMITED' },
      ],
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(subscriptionsState().features.get('basic|assets.avatar_max')).toEqual({
      mode: 'VALUE',
      value: 4,
    });
  });

  it('sends UNSET for a switch that is put back to "Not configured", and a 0 as a value', async () => {
    const calls = useMockBackend(subscriptionsMock);
    renderPage(<EntitlementsPage />);
    const { user, drawer } = await openFeatures('premium');
    await user.click(within(featureRow(drawer, 'assets.voice_max')).getByText('Not configured'));
    fireEvent.change(within(featureRow(drawer, 'assets.avatar_max')).getByRole('spinbutton'), {
      target: { value: '0' },
    });
    await user.click(within(drawer).getByRole('button', { name: /Save/ }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect((writes(calls)[0].body as { features: unknown[] }).features).toEqual([
      { featureKey: 'assets.avatar_max', mode: 'VALUE', value: 0 },
      { featureKey: 'assets.voice_max', mode: 'UNSET' },
    ]);
  });

  it('sends nothing and says so when nothing changed', async () => {
    const calls = useMockBackend(subscriptionsMock);
    renderPage(<EntitlementsPage />);
    const { user, drawer } = await openFeatures('premium');
    await user.click(within(drawer).getByRole('button', { name: /Save/ }));
    expect(await screen.findByText('Nothing changed')).toBeInTheDocument();
    expect(writes(calls)).toHaveLength(0);
  });

  it('asks for the number before sending a value that is empty, and for a whole number', async () => {
    const calls = useMockBackend(subscriptionsMock);
    renderPage(<EntitlementsPage />);
    const { user, drawer } = await openFeatures('basic');
    await user.click(within(featureRow(drawer, 'assets.avatar_max')).getByText('Value'));
    await user.click(within(drawer).getByRole('button', { name: /Save/ }));
    expect(
      await within(featureRow(drawer, 'assets.avatar_max')).findByText('It must not be empty.'),
    ).toBeInTheDocument();
    expect(writes(calls)).toHaveLength(0);
    await user.click(within(featureRow(drawer, 'chat.model_tier')).getByText('Value'));
    await user.click(within(drawer).getByRole('button', { name: /Save/ }));
    expect(
      await within(featureRow(drawer, 'chat.model_tier')).findByText('It must not be empty.'),
    ).toBeInTheDocument();
    expect(writes(calls)).toHaveLength(0);
  });

  it('shows the refusal of the backend for a switch next to it, keeps the drawer open and saves none of the others', async () => {
    const calls = useMockBackend(subscriptionsMock);
    renderPage(<EntitlementsPage />);
    const { user, drawer } = await openFeatures('basic');
    await user.click(within(featureRow(drawer, 'assets.avatar_max')).getByText('Value'));
    fireEvent.change(within(featureRow(drawer, 'assets.avatar_max')).getByRole('spinbutton'), {
      target: { value: '4' },
    });
    await user.click(within(featureRow(drawer, 'memory.tier')).getByText('Value'));
    fireEvent.change(within(featureRow(drawer, 'memory.tier')).getByRole('textbox'), {
      target: { value: 'no-such-tier' },
    });
    await user.click(within(drawer).getByRole('button', { name: /Save/ }));
    expect(
      await within(featureRow(drawer, 'memory.tier')).findByText(
        'The value is outside the allowed range.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(writes(calls)).toHaveLength(1);
    expect(subscriptionsState().features.has('basic|assets.avatar_max')).toBe(false);
  });

  it('sends one request however many times Save is clicked', async () => {
    const calls = useMockBackend(subscriptionsMock);
    renderPage(<EntitlementsPage />);
    const { user, drawer } = await openFeatures('basic');
    await user.click(within(featureRow(drawer, 'assets.voice_max')).getByText('No limit'));
    const save = within(drawer).getByRole('button', { name: /Save/ });
    fireEvent.click(save);
    fireEvent.click(save);
    fireEvent.click(save);
    await waitFor(() => expect(writes(calls).length).toBeGreaterThan(0));
    await new Promise((r) => setTimeout(r, 100));
    expect(writes(calls)).toHaveLength(1);
  });

  it('does not send again when the token ended during the save', async () => {
    const defs = useMockBackend(subscriptionsMock);
    void defs;
    vi.unstubAllGlobals();
    const calls = stubFetch(async ({ url, init }) => {
      if ((init.method ?? 'GET') !== 'GET')
        return jsonResponse(401, envelope('ADMIN_INVALID_TOKEN'));
      if (url.includes('/entitlement-defs'))
        return jsonResponse(
          200,
          envelope('200', {
            items: [
              {
                key: 'basic',
                name: 'Basic',
                priority: 10,
                features: subscriptionsState().gates.map((g) => ({
                  featureKey: g.key,
                  mode: 'UNSET',
                  value: null,
                })),
              },
            ],
          }),
        );
      return jsonResponse(200, envelope('200', { items: subscriptionsState().gates }));
    });
    renderPage(<EntitlementsPage />);
    const { user, drawer } = await openFeatures('basic');
    await user.click(within(featureRow(drawer, 'assets.voice_max')).getByText('No limit'));
    await user.click(within(drawer).getByRole('button', { name: /Save/ }));
    await waitFor(() => expect(calls.filter((c) => c.init.method === 'PUT')).toHaveLength(1));
    await new Promise((r) => setTimeout(r, 100));
    expect(calls.filter((c) => c.init.method === 'PUT')).toHaveLength(1);
  });
});

describe('the reminder about unlimited calls and messages', { timeout: 30000 }, () => {
  const setDefault = (key: string, value: number) => {
    const gate = subscriptionsState().gates.find((g) => g.key === key);
    if (gate) {
      gate.defaultMode = 'VALUE';
      gate.defaultValue = value;
    }
  };

  it('shows when the entitlement sets neither call.daily_minutes nor call.monthly_minutes and neither default is set', async () => {
    useMockBackend(subscriptionsMock);
    renderPage(<EntitlementsPage />);
    const { drawer } = await openFeatures('basic');
    expect(within(drawer).getByText(CALL_WARNING)).toBeInTheDocument();
    expect(within(drawer).getByText(CHAT_WARNING)).toBeInTheDocument();
  });

  it('goes away as soon as one of the two call switches gets a value, either one', async () => {
    useMockBackend(subscriptionsMock);
    renderPage(<EntitlementsPage />);
    const { user, drawer } = await openFeatures('basic');
    await user.click(within(featureRow(drawer, 'call.daily_minutes')).getByText('Value'));
    fireEvent.change(within(featureRow(drawer, 'call.daily_minutes')).getByRole('spinbutton'), {
      target: { value: '30' },
    });
    expect(within(drawer).queryByText(CALL_WARNING)).toBeNull();
    expect(within(drawer).getByText(CHAT_WARNING)).toBeInTheDocument();
    await user.click(within(featureRow(drawer, 'call.daily_minutes')).getByText('Not configured'));
    expect(within(drawer).getByText(CALL_WARNING)).toBeInTheDocument();
    await user.click(within(featureRow(drawer, 'call.monthly_minutes')).getByText('No limit'));
    expect(within(drawer).queryByText(CALL_WARNING)).toBeNull();
  });

  it('does not show for an entitlement that already has one of the two (premium has call.monthly_minutes)', async () => {
    useMockBackend(subscriptionsMock);
    renderPage(<EntitlementsPage />);
    const { drawer } = await openFeatures('premium');
    expect(within(drawer).queryByText(CALL_WARNING)).toBeNull();
    expect(within(drawer).getByText(CHAT_WARNING)).toBeInTheDocument();
  });

  it('does not show when either default of the two is set, even with nothing in the entitlement', async () => {
    setDefault('call.monthly_minutes', 60);
    setDefault('chat.daily_messages', 10);
    useMockBackend(subscriptionsMock);
    renderPage(<EntitlementsPage />);
    const { drawer } = await openFeatures('basic');
    expect(within(drawer).queryByText(CALL_WARNING)).toBeNull();
    expect(within(drawer).queryByText(CHAT_WARNING)).toBeNull();
  });

  it('is not moved by call.lifetime_minutes, whose default only matters to free accounts', async () => {
    setDefault('call.lifetime_minutes', 30);
    useMockBackend(subscriptionsMock);
    renderPage(<EntitlementsPage />);
    const { drawer } = await openFeatures('basic');
    expect(within(drawer).getByText(CALL_WARNING)).toBeInTheDocument();
  });
});

describe('who sees the buttons', { timeout: 30000 }, () => {
  it('gives an administrator with only SUBSCRIPTION:VIEW the values to read but no Save, New or Edit, and disabled editors', async () => {
    as(['SUBSCRIPTION:VIEW']);
    useMockBackend(subscriptionsMock);
    renderPage(<EntitlementsPage />);
    expect(screen.queryByRole('button', { name: 'New entitlement' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    const { drawer } = await openFeatures('premium');
    expect(within(drawer).queryByRole('button', { name: /Save/ })).toBeNull();
    for (const radio of within(drawer).getAllByRole('radio')) expect(radio).toBeDisabled();
    expect(within(featureRow(drawer, 'assets.avatar_max')).getByRole('spinbutton')).toBeDisabled();
  });

  it('shows Save, New and Edit to an administrator with SUBSCRIPTION:CONFIG', async () => {
    as(['SUBSCRIPTION:VIEW', 'SUBSCRIPTION:CONFIG']);
    useMockBackend(subscriptionsMock);
    renderPage(<EntitlementsPage />);
    expect(await screen.findByRole('button', { name: 'New entitlement' })).toBeInTheDocument();
    const { drawer } = await openFeatures('premium');
    expect(within(drawer).getByRole('button', { name: /Save/ })).toBeInTheDocument();
  });

  it('does not show Save to an administrator with only SUBSCRIPTION:GRANT and SUBSCRIPTION:VIEW', async () => {
    as(['SUBSCRIPTION:VIEW', 'SUBSCRIPTION:GRANT']);
    useMockBackend(subscriptionsMock);
    renderPage(<EntitlementsPage />);
    const { drawer } = await openFeatures('premium');
    expect(within(drawer).queryByRole('button', { name: /Save/ })).toBeNull();
  });
});

describe('creating and editing an entitlement', { timeout: 30000 }, () => {
  it('creates an entitlement with a key, a name and a priority', async () => {
    const calls = useMockBackend(subscriptionsMock);
    const user = userEvent.setup();
    renderPage(<EntitlementsPage />);
    await user.click(await screen.findByRole('button', { name: 'New entitlement' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Key'), { target: { value: 'gold_vn' } });
    fireEvent.change(within(dialog).getByLabelText('Name'), {
      target: { value: 'Vàng — Gói cao cấp' },
    });
    fireEvent.change(within(dialog).getByLabelText('Priority'), { target: { value: '50' } });
    await user.click(within(dialog).getByRole('button', { name: /Save/ }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(writes(calls)[0]).toMatchObject({
      method: 'POST',
      url: '/api/admin/entitlement-defs',
      body: { key: 'gold_vn', name: 'Vàng — Gói cao cấp', priority: 50 },
    });
    expect(await rowOf('gold_vn')).toBeInTheDocument();
  });

  it('puts a taken key or priority on the field the backend names (409 DUPLICATE_RESOURCE)', async () => {
    useMockBackend(subscriptionsMock);
    const user = userEvent.setup();
    renderPage(<EntitlementsPage />);
    await user.click(await screen.findByRole('button', { name: 'New entitlement' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Key'), { target: { value: 'gold' } });
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Gold' } });
    fireEvent.change(within(dialog).getByLabelText('Priority'), { target: { value: '20' } });
    await user.click(within(dialog).getByRole('button', { name: /Save/ }));
    const message = 'An item with the same unique value already exists.';
    const item = (await within(dialog).findByText(message)).closest(
      '.ant-form-item',
    ) as HTMLElement;
    expect(within(item).getByLabelText('Priority')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('sends one request while the save of the dialog is under way, however often Save is clicked then', async () => {
    useMockBackend(subscriptionsMock);
    const held = holdRequests((_, method) => method === 'POST');
    const user = userEvent.setup();
    renderPage(<EntitlementsPage />);
    await user.click(await screen.findByRole('button', { name: 'New entitlement' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Key'), { target: { value: 'gold_vn' } });
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Gold' } });
    fireEvent.change(within(dialog).getByLabelText('Priority'), { target: { value: '50' } });
    const save = within(dialog).getByRole('button', { name: /Save/ });
    fireEvent.click(save);
    await waitFor(() => expect(held.started()).toBe(1));
    fireEvent.click(save);
    fireEvent.click(save);
    await new Promise((r) => setTimeout(r, 150));
    expect(held.started()).toBe(1);
    held.release();
  });

  it('shows a refusal that names no field of the dialog above the form instead of swallowing it', async () => {
    useMockBackend(subscriptionsMock);
    const real = globalThis.fetch;
    let answer: Response = jsonResponse(
      400,
      envelope('INVALID_REQUEST', { details: [{ ref: 'somethingElse', reason: 'OUT_OF_RANGE' }] }),
    );
    vi.stubGlobal('fetch', async (input: string | URL, init?: RequestInit) =>
      init?.method === 'POST' ? answer.clone() : real(input, init),
    );
    const user = userEvent.setup();
    renderPage(<EntitlementsPage />);
    await user.click(await screen.findByRole('button', { name: 'New entitlement' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Key'), { target: { value: 'gold_vn' } });
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Gold' } });
    fireEvent.change(within(dialog).getByLabelText('Priority'), { target: { value: '50' } });
    await user.click(within(dialog).getByRole('button', { name: /Save/ }));
    expect(await within(dialog).findByText('somethingElse')).toBeInTheDocument();
    expect(within(dialog).getByText('The value is outside the allowed range.')).toBeInTheDocument();
    // a taken value on a field that is not one of the three is shown the same way
    answer = jsonResponse(409, envelope('DUPLICATE_RESOURCE', { field: 'unheardOf' }));
    await user.click(within(dialog).getByRole('button', { name: /Save/ }));
    expect(
      await within(dialog).findByText('An item with the same unique value already exists.'),
    ).toBeInTheDocument();
    expect(within(dialog).queryByText('somethingElse')).not.toBeInTheDocument();
  });

  it('shows the list the last read brought when the answer of an earlier read arrives late', async () => {
    useMockBackend(subscriptionsMock);
    // the 2nd read of the entitlements (after the first one was created) is held; the 3rd is not
    const held = holdRequests(
      (url, method) => method === 'GET' && url.endsWith('/entitlement-defs'),
      2,
    );
    const user = userEvent.setup();
    renderPage(<EntitlementsPage />);
    const create = async (key: string, priority: string) => {
      await user.click(await screen.findByRole('button', { name: 'New entitlement' }));
      const dialog = await screen.findByRole('dialog');
      fireEvent.change(within(dialog).getByLabelText('Key'), { target: { value: key } });
      fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: key } });
      fireEvent.change(within(dialog).getByLabelText('Priority'), { target: { value: priority } });
      await user.click(within(dialog).getByRole('button', { name: /Save/ }));
    };
    await create('first_new', '61');
    await waitFor(() => expect(held.started()).toBe(2));
    await create('second_new', '62');
    await waitFor(() =>
      expect(subscriptionsState().defs.some((d) => d.key === 'second_new')).toBe(true),
    );
    held.release();
    await new Promise((r) => setTimeout(r, 200));
    // the held read knew only the first: the second must not vanish from the list
    expect(await rowOf('first_new')).toBeInTheDocument();
    expect(await rowOf('second_new')).toBeInTheDocument();
  });

  it('keeps a title of the feature values drawer inside the drawer when the name is 5000 characters without spaces', async () => {
    useMockBackend(subscriptionsMock);
    const long = 'ก'.repeat(5000);
    const basic = subscriptionsState().defs.find((d) => d.key === 'basic');
    if (basic) basic.name = long;
    renderPage(<EntitlementsPage />);
    const { drawer } = await openFeatures('basic');
    const title = drawer.querySelector('.ant-drawer-title') as HTMLElement;
    expect(title.textContent).toContain(long);
    const inner = title.querySelector('span') as HTMLElement;
    expect(inner.style.overflowWrap).toBe('anywhere');
  });

  it('asks for a key, a name and a priority before sending', async () => {
    const calls = useMockBackend(subscriptionsMock);
    const user = userEvent.setup();
    renderPage(<EntitlementsPage />);
    await user.click(await screen.findByRole('button', { name: 'New entitlement' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /Save/ }));
    await waitFor(() =>
      expect(within(dialog).getAllByText('It must not be empty.').length).toBeGreaterThanOrEqual(3),
    );
    expect(writes(calls)).toHaveLength(0);
  });

  it('edits the name and the priority, but not the key', async () => {
    const calls = useMockBackend(subscriptionsMock);
    const user = userEvent.setup();
    renderPage(<EntitlementsPage />);
    const row = await rowOf('plus_th');
    await user.click(within(row).getByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Key')).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText('Priority'), { target: { value: '35' } });
    await user.click(within(dialog).getByRole('button', { name: /Save/ }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(writes(calls)[0]).toMatchObject({
      method: 'PUT',
      url: '/api/admin/entitlement-defs/plus_th',
    });
    expect(writes(calls)[0].body).toMatchObject({ priority: 35 });
  });
});
