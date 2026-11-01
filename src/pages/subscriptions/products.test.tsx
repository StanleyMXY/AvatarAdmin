import './testSetup';
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
import ProductsPage from './products';

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
const rowOf = async (productId: string) => {
  const cell = await screen.findByText(productId, { selector: 'button, td' });
  return cell.closest('tr') as HTMLElement;
};

/** Picks an option of an antd Select that sits in `scope`, by its text. */
async function choose(
  user: ReturnType<typeof userEvent.setup>,
  scope: HTMLElement,
  label: string,
  option: string | RegExp,
) {
  const select = within(scope).getByLabelText(label);
  await user.click(select);
  const item = await screen.findByTitle(option instanceof RegExp ? option : option);
  await user.click(item);
}

describe('the product mapping list', { timeout: 30000 }, () => {
  it('shows store, product, the entitlement by name and key, the sale switch and the sort order', async () => {
    useMockBackend(subscriptionsMock);
    renderPage(<ProductsPage />);
    const row = await rowOf('avatar.premium.monthly');
    expect(within(row).getByText('APPLE')).toBeInTheDocument();
    expect(within(row).getByText('premium', { selector: 'code' })).toBeInTheDocument();
    expect(within(row).getByRole('switch')).toBeChecked();
    const off = await rowOf('avatar_plus_monthly');
    expect(within(off).getByRole('switch')).not.toBeChecked();
    expect(within(off).getByText(/พรีเมียม|ภาษาไทย/)).toBeInTheDocument();
    expect(document.querySelectorAll('tbody tr.ant-table-row')).toHaveLength(4);
  });

  it('keeps a product id of 5000 characters without spaces inside its cell, and shows ids of every script', async () => {
    const products = subscriptionsState().products;
    products[0].productId = 'x'.repeat(5000);
    products[1].productId = 'สินค้า_พรีเมียม';
    products[2].productId = 'منتج_مميز';
    useMockBackend(subscriptionsMock);
    renderPage(<ProductsPage />);
    await screen.findByText('สินค้า_พรีเมียม');
    expect(screen.getByText('منتج_مميز')).toBeInTheDocument();
    const clamp = [...document.querySelectorAll('tbody button[data-lines]')] as HTMLElement[];
    expect(clamp.length).toBeGreaterThan(0);
    for (const b of clamp) expect(b.style.overflowWrap).toBe('anywhere');
  });

  it('shows an entitlement the server no longer lists by its key, and a failed read with a retry', async () => {
    subscriptionsState().products[0].entitlementKey = 'removed_one';
    useMockBackend(subscriptionsMock);
    renderPage(<ProductsPage />);
    expect(await screen.findByText('removed_one')).toBeInTheDocument();
  });

  it('shows a failed read with a retry', async () => {
    stubFetch(async () => jsonResponse(503, envelope('DEPENDENCY_UNAVAILABLE')));
    renderPage(<ProductsPage />);
    expect(await screen.findByText(/Failed to load/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});

describe('the sale switch', { timeout: 30000 }, () => {
  it('saves the whole mapping with the switch turned, at once', async () => {
    const calls = useMockBackend(subscriptionsMock);
    renderPage(<ProductsPage />);
    const row = await rowOf('avatar_plus_monthly');
    fireEvent.click(within(row).getByRole('switch'));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(writes(calls)[0]).toMatchObject({
      method: 'PUT',
      url: '/api/admin/subscription-products',
      body: {
        store: 'GOOGLE',
        productId: 'avatar_plus_monthly',
        entitlementKey: 'plus_th',
        enabled: true,
        sortOrder: 3,
        surfaces: ['ANDROID'],
      },
    });
    await waitFor(() =>
      expect(
        subscriptionsState().products.find((p) => p.productId === 'avatar_plus_monthly')?.enabled,
      ).toBe(true),
    );
  });

  it('sends one request for clicks that come one after the other', async () => {
    const calls = useMockBackend(subscriptionsMock);
    renderPage(<ProductsPage />);
    const row = await rowOf('avatar_plus_monthly');
    const toggle = within(row).getByRole('switch');
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    await waitFor(() => expect(writes(calls).length).toBeGreaterThan(0));
    await new Promise((r) => setTimeout(r, 100));
    expect(writes(calls)).toHaveLength(1);
  });

  it('puts the switch back and says why when the backend refuses', async () => {
    stubFetch(async ({ init }) =>
      (init.method ?? 'GET') === 'GET'
        ? jsonResponse(
            200,
            envelope('200', {
              items: [
                {
                  store: 'APPLE',
                  productId: 'p1',
                  entitlementKey: 'premium',
                  enabled: true,
                  sortOrder: 1,
                  surfaces: [],
                },
              ],
            }),
          )
        : jsonResponse(403, envelope('ADMIN_FORBIDDEN')),
    );
    renderPage(<ProductsPage />);
    const row = await rowOf('p1');
    fireEvent.click(within(row).getByRole('switch'));
    expect(await screen.findByText(/permission/i)).toBeInTheDocument();
    await waitFor(async () => expect(within(await rowOf('p1')).getByRole('switch')).toBeChecked());
  });

  it('says which field and why when the backend refuses the switch with details', async () => {
    stubFetch(async ({ init }) =>
      (init.method ?? 'GET') === 'GET'
        ? jsonResponse(
            200,
            envelope('200', {
              items: [
                {
                  store: 'APPLE',
                  productId: 'p1',
                  entitlementKey: 'premium',
                  enabled: false,
                  sortOrder: 1,
                  surfaces: [],
                },
              ],
            }),
          )
        : jsonResponse(
            400,
            envelope('INVALID_REQUEST', {
              details: [{ ref: 'entitlementKey', reason: 'OUT_OF_RANGE' }],
            }),
          ),
    );
    renderPage(<ProductsPage />);
    const row = await rowOf('p1');
    fireEvent.click(within(row).getByRole('switch'));
    expect(await screen.findByText(/entitlementKey: /)).toBeInTheDocument();
  });

  it('does not send again when the token ended during the write', async () => {
    const calls = stubFetch(async ({ init }) =>
      (init.method ?? 'GET') === 'GET'
        ? jsonResponse(
            200,
            envelope('200', {
              items: [
                {
                  store: 'APPLE',
                  productId: 'p1',
                  entitlementKey: 'premium',
                  enabled: true,
                  sortOrder: 1,
                  surfaces: [],
                },
              ],
            }),
          )
        : jsonResponse(401, envelope('ADMIN_INVALID_TOKEN')),
    );
    renderPage(<ProductsPage />);
    const row = await rowOf('p1');
    fireEvent.click(within(row).getByRole('switch'));
    await waitFor(() => expect(calls.filter((c) => c.init.method === 'PUT')).toHaveLength(1));
    await new Promise((r) => setTimeout(r, 100));
    expect(calls.filter((c) => c.init.method === 'PUT')).toHaveLength(1);
  });
});

describe('who sees the buttons', { timeout: 30000 }, () => {
  it('gives an administrator with only SUBSCRIPTION:VIEW a read-only list', async () => {
    as(['SUBSCRIPTION:VIEW']);
    useMockBackend(subscriptionsMock);
    renderPage(<ProductsPage />);
    const row = await rowOf('avatar.premium.monthly');
    expect(within(row).getByRole('switch')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'New product' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
  });

  it('shows New product and Edit to an administrator with SUBSCRIPTION:CONFIG', async () => {
    as(['SUBSCRIPTION:VIEW', 'SUBSCRIPTION:CONFIG']);
    useMockBackend(subscriptionsMock);
    renderPage(<ProductsPage />);
    const row = await rowOf('avatar.premium.monthly');
    expect(within(row).getByRole('switch')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'New product' })).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });

  it('does not show them for SUBSCRIPTION:GRANT, which is for events and limited-time grants', async () => {
    as(['SUBSCRIPTION:VIEW', 'SUBSCRIPTION:GRANT']);
    useMockBackend(subscriptionsMock);
    renderPage(<ProductsPage />);
    await rowOf('avatar.premium.monthly');
    expect(screen.queryByRole('button', { name: 'New product' })).toBeNull();
  });
});

describe('editing and adding a mapping', { timeout: 30000 }, () => {
  it('edits the entitlement and the sort order of a mapping, with the store and the product id fixed, keeping the surfaces', async () => {
    const calls = useMockBackend(subscriptionsMock);
    const user = userEvent.setup();
    renderPage(<ProductsPage />);
    const row = await rowOf('avatar_plus_monthly');
    await user.click(within(row).getByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Store')).toBeDisabled();
    expect(within(dialog).getByLabelText('Product ID')).toBeDisabled();
    await choose(user, dialog, 'Entitlement', /\(premium\)$/);
    fireEvent.change(within(dialog).getByLabelText('Sort order'), { target: { value: '7' } });
    await user.click(within(dialog).getByRole('button', { name: /Save/ }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(writes(calls)[0].body).toEqual({
      store: 'GOOGLE',
      productId: 'avatar_plus_monthly',
      entitlementKey: 'premium',
      enabled: false,
      sortOrder: 7,
      surfaces: ['ANDROID'],
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('adds a mapping with a store, a product id and an entitlement', async () => {
    const calls = useMockBackend(subscriptionsMock);
    const user = userEvent.setup();
    renderPage(<ProductsPage />);
    await user.click(await screen.findByRole('button', { name: 'New product' }));
    const dialog = await screen.findByRole('dialog');
    await choose(user, dialog, 'Store', 'APPLE');
    fireEvent.change(within(dialog).getByLabelText('Product ID'), {
      target: { value: 'avatar.vip.weekly' },
    });
    await choose(user, dialog, 'Entitlement', /\(basic\)$/);
    fireEvent.change(within(dialog).getByLabelText('Sort order'), { target: { value: '9' } });
    await user.click(within(dialog).getByRole('button', { name: /Save/ }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(writes(calls)[0].body).toMatchObject({
      store: 'APPLE',
      productId: 'avatar.vip.weekly',
      entitlementKey: 'basic',
      enabled: true,
      sortOrder: 9,
    });
    expect(await screen.findByText('avatar.vip.weekly')).toBeInTheDocument();
  });

  it('refuses a store and product id that are already mapped, without sending', async () => {
    const calls = useMockBackend(subscriptionsMock);
    const user = userEvent.setup();
    renderPage(<ProductsPage />);
    await user.click(await screen.findByRole('button', { name: 'New product' }));
    const dialog = await screen.findByRole('dialog');
    await choose(user, dialog, 'Store', 'APPLE');
    fireEvent.change(within(dialog).getByLabelText('Product ID'), {
      target: { value: 'avatar.premium.monthly' },
    });
    await choose(user, dialog, 'Entitlement', /\(premium\)$/);
    fireEvent.change(within(dialog).getByLabelText('Sort order'), { target: { value: '1' } });
    await user.click(within(dialog).getByRole('button', { name: /Save/ }));
    expect(
      await within(dialog).findByText('This product is already mapped. Edit it instead.'),
    ).toBeInTheDocument();
    expect(writes(calls)).toHaveLength(0);
  });

  it('asks for the store, the product id, the entitlement and the sort order before sending', async () => {
    const calls = useMockBackend(subscriptionsMock);
    const user = userEvent.setup();
    renderPage(<ProductsPage />);
    await user.click(await screen.findByRole('button', { name: 'New product' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /Save/ }));
    await waitFor(() =>
      expect(within(dialog).getAllByText('It must not be empty.').length).toBeGreaterThanOrEqual(4),
    );
    expect(writes(calls)).toHaveLength(0);
  });

  it('shows the refusal of the backend in the dialog and keeps it open', async () => {
    stubFetch(async ({ url, init }) => {
      if ((init.method ?? 'GET') === 'GET' && url.includes('entitlement-defs'))
        return jsonResponse(
          200,
          envelope('200', {
            items: [{ key: 'premium', name: 'Premium', priority: 1, features: [] }],
          }),
        );
      if ((init.method ?? 'GET') === 'GET' && url.includes('feature-gates'))
        return jsonResponse(200, envelope('200', { items: [] }));
      if ((init.method ?? 'GET') === 'GET')
        return jsonResponse(
          200,
          envelope('200', {
            items: [
              {
                store: 'APPLE',
                productId: 'p1',
                entitlementKey: 'premium',
                enabled: true,
                sortOrder: 1,
                surfaces: [],
              },
            ],
          }),
        );
      return jsonResponse(
        400,
        envelope('INVALID_REQUEST', {
          details: [{ ref: 'entitlementKey', reason: 'OUT_OF_RANGE' }],
        }),
      );
    });
    const user = userEvent.setup();
    renderPage(<ProductsPage />);
    const row = await rowOf('p1');
    await user.click(within(row).getByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /Save/ }));
    expect(
      await within(dialog).findByText('The value is outside the allowed range.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('sends one request however many times Save is clicked', async () => {
    const calls = useMockBackend(subscriptionsMock);
    const user = userEvent.setup();
    renderPage(<ProductsPage />);
    const row = await rowOf('avatar_plus_monthly');
    await user.click(within(row).getByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog');
    const save = within(dialog).getByRole('button', { name: /Save/ });
    fireEvent.click(save);
    fireEvent.click(save);
    fireEvent.click(save);
    await waitFor(() => expect(writes(calls).length).toBeGreaterThan(0));
    await new Promise((r) => setTimeout(r, 100));
    expect(writes(calls)).toHaveLength(1);
  });
  it('sends one request while the save of the dialog is under way, however often Save is clicked then', async () => {
    useMockBackend(subscriptionsMock);
    const held = holdRequests((_, method) => method === 'PUT');
    const user = userEvent.setup();
    renderPage(<ProductsPage />);
    const row = await rowOf('avatar_plus_monthly');
    await user.click(within(row).getByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog');
    const save = within(dialog).getByRole('button', { name: /Save/ });
    fireEvent.click(save);
    await waitFor(() => expect(held.started()).toBe(1));
    fireEvent.click(save);
    fireEvent.click(save);
    await new Promise((r) => setTimeout(r, 150));
    expect(held.started()).toBe(1);
    held.release();
  });

  it('shows the list the last read brought when the answer of an earlier read arrives late', async () => {
    useMockBackend(subscriptionsMock);
    // the 2nd read of the mappings (the one after the first switch) is held; the 3rd is not
    const held = holdRequests(
      (url, method) => method === 'GET' && url.endsWith('/subscription-products'),
      2,
    );
    renderPage(<ProductsPage />);
    const plus = await rowOf('avatar_plus_monthly');
    expect(within(plus).getByRole('switch')).not.toBeChecked();
    fireEvent.click(within(plus).getByRole('switch'));
    await waitFor(() => expect(held.started()).toBe(2)); // the first reload is held
    const premium = await rowOf('avatar.premium.monthly');
    fireEvent.click(within(premium).getByRole('switch'));
    await waitFor(() =>
      expect(
        subscriptionsState().products.find((p) => p.productId === 'avatar.premium.monthly')
          ?.enabled,
      ).toBe(false),
    );
    held.release();
    await new Promise((r) => setTimeout(r, 150));
    // both changes are on the screen: the held read, which knew only the first, did not win
    expect(within(await rowOf('avatar_plus_monthly')).getByRole('switch')).toBeChecked();
    expect(within(await rowOf('avatar.premium.monthly')).getByRole('switch')).not.toBeChecked();
  });
});

describe('the reminder when the entitlement leaves the quotas unset', { timeout: 30000 }, () => {
  const open = async () => {
    const user = userEvent.setup();
    renderPage(<ProductsPage />);
    const row = await rowOf('avatar_plus_monthly');
    await user.click(within(row).getByRole('button', { name: 'Edit' }));
    return { user, dialog: await screen.findByRole('dialog') };
  };

  it('shows both reminders for an entitlement that sets no call or text quota while no default is set (plus_th)', async () => {
    useMockBackend(subscriptionsMock);
    const { dialog } = await open();
    expect(within(dialog).getByText(CALL_WARNING)).toBeInTheDocument();
    expect(within(dialog).getByText(CHAT_WARNING)).toBeInTheDocument();
  });

  it('follows the entitlement that is chosen: premium sets call.monthly_minutes, so only the text reminder stays', async () => {
    useMockBackend(subscriptionsMock);
    const { user, dialog } = await open();
    await choose(user, dialog, 'Entitlement', /\(premium\)$/);
    expect(within(dialog).queryByText(CALL_WARNING)).toBeNull();
    expect(within(dialog).getByText(CHAT_WARNING)).toBeInTheDocument();
  });

  it('shows nothing once either default of the pair is set', async () => {
    for (const key of ['call.daily_minutes', 'chat.monthly_messages']) {
      const gate = subscriptionsState().gates.find((g) => g.key === key);
      if (gate) {
        gate.defaultMode = 'VALUE';
        gate.defaultValue = 5;
      }
    }
    useMockBackend(subscriptionsMock);
    const { dialog } = await open();
    expect(within(dialog).queryByText(CALL_WARNING)).toBeNull();
    expect(within(dialog).queryByText(CHAT_WARNING)).toBeNull();
  });

  it('does not stop the save: it is a reminder', async () => {
    const calls = useMockBackend(subscriptionsMock);
    const { user, dialog } = await open();
    expect(within(dialog).getByText(CALL_WARNING)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: /Save/ }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
  });
});
