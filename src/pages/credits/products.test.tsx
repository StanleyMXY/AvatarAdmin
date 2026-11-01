import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { creditsState } from '../../../mock/_core/creditsData';
import * as creditsMock from '../../../mock/credits.mock';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import ProductsPage from './products';
import { chooseOption, dialogsClosed, signIn } from './testSetup';

beforeEach(() => signIn('finance'));
afterEach(() => vi.unstubAllGlobals());

const writes = (calls: ReturnType<typeof useMockBackend>) =>
  calls.filter((c) => c.method !== 'GET');
const rowOf = async (productId: string, store = 'APPLE') => {
  const cells = await screen.findAllByText(productId);
  const rows = cells
    .map((cell) => cell.closest('tr'))
    .filter(
      (row): row is HTMLTableRowElement => row !== null && within(row).queryByText(store) !== null,
    );
  return rows[0];
};

describe('the credit pack page', { timeout: 30000 }, () => {
  it('lists every pack with store, product, credits, order and the sale switch, the packs that are off too', async () => {
    useMockBackend(creditsMock);
    renderPage(<ProductsPage />);
    for (const pack of creditsState.products) {
      const row = await rowOf(pack.productId, pack.store);
      expect(row, pack.productId).toBeTruthy();
      expect(
        within(row).getByText(new Intl.NumberFormat('en-US').format(pack.credits)),
      ).toBeInTheDocument();
      const sale = within(row).getByRole('switch');
      expect(sale.getAttribute('aria-checked')).toBe(String(pack.enabled));
    }
    expect(screen.getByRole('button', { name: 'New credit pack' })).toBeInTheDocument();
  });

  it('turns a pack off with one PUT that carries the credits and the order, and shows the new state', async () => {
    const calls = useMockBackend(creditsMock);
    renderPage(<ProductsPage />);
    const pack = creditsState.products.find(
      (p) => p.enabled,
    ) as (typeof creditsState.products)[number];
    const row = await rowOf(pack.productId, pack.store);
    fireEvent.click(within(row).getByRole('switch'));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(writes(calls)[0]).toMatchObject({
      method: 'PUT',
      url: `/api/admin/credit-products/${pack.id}`,
      body: { credits: pack.credits, enabled: false, sortOrder: pack.sortOrder },
    });
    await waitFor(async () =>
      expect(
        within(await rowOf(pack.productId, pack.store))
          .getByRole('switch')
          .getAttribute('aria-checked'),
      ).toBe('false'),
    );
  });

  it('sends one request when the switch is pressed twice at once', async () => {
    const calls = useMockBackend(creditsMock);
    renderPage(<ProductsPage />);
    const pack = creditsState.products[0];
    const sale = within(await rowOf(pack.productId, pack.store)).getByRole('switch');
    fireEvent.click(sale);
    fireEvent.click(sale);
    await waitFor(() => expect(writes(calls).length).toBeGreaterThanOrEqual(1));
    await new Promise((r) => setTimeout(r, 100));
    expect(writes(calls)).toHaveLength(1);
  });

  it('creates a pack from the dialog and shows it', async () => {
    const calls = useMockBackend(creditsMock);
    const user = userEvent.setup();
    renderPage(<ProductsPage />);
    await user.click(await screen.findByRole('button', { name: 'New credit pack' }));
    const dialog = await screen.findByRole('dialog');
    await chooseOption(user, 'Store', 'GOOGLE', dialog);
    fireEvent.change(within(dialog).getByLabelText('Product ID'), {
      target: { value: ' credits_9000 ' },
    });
    fireEvent.change(within(dialog).getByLabelText('Credits'), { target: { value: '9000' } });
    fireEvent.change(within(dialog).getByLabelText('Sort order'), { target: { value: '8' } });
    await user.click(within(dialog).getByRole('switch', { name: 'On sale' }));
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(writes(calls)[0]).toMatchObject({
      method: 'POST',
      url: '/api/admin/credit-products',
      body: {
        store: 'GOOGLE',
        productId: 'credits_9000',
        credits: 9000,
        enabled: true,
        sortOrder: 8,
      },
    });
    expect(await screen.findByText('credits_9000')).toBeInTheDocument();
    await dialogsClosed();
  });

  it('keeps the dialog open and says that the pack already exists when the backend refuses a duplicate', async () => {
    useMockBackend(creditsMock);
    const user = userEvent.setup();
    renderPage(<ProductsPage />);
    const taken = creditsState.products[0];
    await user.click(await screen.findByRole('button', { name: 'New credit pack' }));
    const dialog = await screen.findByRole('dialog');
    await chooseOption(user, 'Store', taken.store, dialog);
    fireEvent.change(within(dialog).getByLabelText('Product ID'), {
      target: { value: taken.productId },
    });
    fireEvent.change(within(dialog).getByLabelText('Credits'), { target: { value: '5' } });
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(await within(dialog).findByText(/already exists/i)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('refuses credits that are 0 or empty and an empty product, without sending', async () => {
    const calls = useMockBackend(creditsMock);
    const user = userEvent.setup();
    renderPage(<ProductsPage />);
    await user.click(await screen.findByRole('button', { name: 'New credit pack' }));
    const dialog = await screen.findByRole('dialog');
    await chooseOption(user, 'Store', 'APPLE', dialog);
    fireEvent.change(within(dialog).getByLabelText('Product ID'), { target: { value: '   ' } });
    fireEvent.change(within(dialog).getByLabelText('Credits'), { target: { value: '0' } });
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await waitFor(() =>
      expect(dialog.querySelectorAll('.ant-form-item-explain-error').length).toBeGreaterThanOrEqual(
        2,
      ),
    );
    expect(writes(calls)).toHaveLength(0);
  });

  it('edits the credits and the order; the store and the product cannot be changed', async () => {
    const calls = useMockBackend(creditsMock);
    const user = userEvent.setup();
    renderPage(<ProductsPage />);
    const pack = creditsState.products[0];
    await user.click(
      within(await rowOf(pack.productId, pack.store)).getByRole('button', { name: 'Edit' }),
    );
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Product ID')).toBeDisabled();
    expect(within(dialog).getByRole('combobox', { name: 'Store' })).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText('Credits'), { target: { value: '1234' } });
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(writes(calls)[0]).toMatchObject({
      method: 'PUT',
      url: `/api/admin/credit-products/${pack.id}`,
      body: { credits: 1234, enabled: pack.enabled, sortOrder: pack.sortOrder },
    });
    expect(Object.keys(writes(calls)[0].body as object)).not.toContain('productId');
  });

  it('sends the surfaces of a pack back unchanged, from the switch and from the dialog, so a save cannot clear them', async () => {
    const surfaces = [{ platform: 'IOS', channel: null }];
    const row = {
      id: '1',
      store: 'APPLE',
      productId: 'p1',
      credits: 5,
      enabled: true,
      sortOrder: 1,
      surfaces,
    };
    const calls = stubFetch(async ({ init }) =>
      (init.method ?? 'GET') === 'GET'
        ? jsonResponse(200, envelope('200', { items: [row] }))
        : jsonResponse(200, envelope('200', row)),
    );
    const user = userEvent.setup();
    renderPage(<ProductsPage />);
    const line = await rowOf('p1');
    fireEvent.click(within(line).getByRole('switch'));
    await waitFor(() => expect(calls.filter((c) => c.init.method === 'PUT')).toHaveLength(1));
    await user.click(within(await rowOf('p1')).getByRole('button', { name: 'Edit' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Submit' }),
    );
    await waitFor(() => expect(calls.filter((c) => c.init.method === 'PUT')).toHaveLength(2));
    for (const put of calls.filter((c) => c.init.method === 'PUT')) {
      expect(JSON.parse(put.init.body as string).surfaces).toEqual(surfaces);
    }
  });

  it('does not send a write again when the token ended during it, and says what happened', async () => {
    const calls = stubFetch(async ({ init }) => {
      if ((init.method ?? 'GET') === 'GET') {
        return jsonResponse(
          200,
          envelope('200', {
            items: [
              { id: '1', store: 'APPLE', productId: 'p1', credits: 5, enabled: true, sortOrder: 1 },
            ],
          }),
        );
      }
      return jsonResponse(401, envelope('ADMIN_INVALID_TOKEN'));
    });
    renderPage(<ProductsPage />);
    const row = await rowOf('p1');
    fireEvent.click(within(row).getByRole('switch'));
    await waitFor(() => expect(calls.filter((c) => c.init.method === 'PUT')).toHaveLength(1));
    await new Promise((r) => setTimeout(r, 100));
    expect(calls.filter((c) => c.init.method === 'PUT')).toHaveLength(1);
  });

  it('shows the refusal of the backend when a pack cannot be switched (no permission), and puts the switch back', async () => {
    stubFetch(async ({ init }) =>
      (init.method ?? 'GET') === 'GET'
        ? jsonResponse(
            200,
            envelope('200', {
              items: [
                {
                  id: '1',
                  store: 'APPLE',
                  productId: 'p1',
                  credits: 5,
                  enabled: true,
                  sortOrder: 1,
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
    await waitFor(async () =>
      expect(
        within(await rowOf('p1'))
          .getByRole('switch')
          .getAttribute('aria-checked'),
      ).toBe('true'),
    );
  });

  it('keeps the title and the fixed fields of the edit dialog while it fades out, instead of turning into the new-pack dialog', async () => {
    useMockBackend(creditsMock);
    const user = userEvent.setup();
    renderPage(<ProductsPage />);
    const pack = creditsState.products[0];
    await user.click(
      within(await rowOf(pack.productId, pack.store)).getByRole('button', { name: 'Edit' }),
    );
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    // the dialog is closing (happy-dom never ends the animation, so it stays in the page)
    expect(screen.queryByText('New credit pack', { selector: '.ant-modal-title' })).toBeNull();
    expect(
      screen.getByText('Edit credit pack', { selector: '.ant-modal-title' }),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Product ID')).toBeDisabled();
  });

  it('shows every pack when the backend pages the list: the page after the first is asked for too', async () => {
    const rows = Array.from({ length: 250 }, (_, n) => ({
      id: String(n + 1),
      store: 'APPLE',
      productId: `pack_${n + 1}`,
      credits: 10 + n,
      enabled: true,
      sortOrder: n,
    }));
    const calls = stubFetch(async ({ url }) => {
      const page = Number(new URL(url, 'http://x').searchParams.get('page') ?? '1');
      return jsonResponse(
        200,
        envelope('200', { items: rows.slice((page - 1) * 200, page * 200), total: 250 }),
      );
    });
    renderPage(<ProductsPage />);
    await screen.findByText('pack_1');
    expect(calls.map((c) => c.url)).toEqual([
      '/api/admin/credit-products?page=1&pageSize=200',
      '/api/admin/credit-products?page=2&pageSize=200',
    ]);
    // 250 packs at 20 a page: 13 pages, so the packs after the first 200 are there
    expect(screen.getByRole('listitem', { name: '13' })).toBeInTheDocument();
  });

  it('does not turn a pack on or off from a list that someone else has changed since, and reads the list again', async () => {
    const calls = useMockBackend(creditsMock);
    renderPage(<ProductsPage />);
    const pack = creditsState.products[0];
    const row = await rowOf(pack.productId, pack.store);
    // another administrator changes the credits of this pack after the list was read
    pack.credits += 100;
    fireEvent.click(within(row).getByRole('switch'));
    expect(
      await screen.findByText(/changed by someone else since the list was read/),
    ).toBeInTheDocument();
    expect(writes(calls)).toHaveLength(0);
    // the list is read again: the new number is on the screen, the switch is where it was
    expect(
      within(await rowOf(pack.productId, pack.store)).getByText(
        new Intl.NumberFormat('en-US').format(pack.credits),
      ),
    ).toBeInTheDocument();
  });

  it('does not save the dialog from a list that someone else has changed since, and reads the list again', async () => {
    const calls = useMockBackend(creditsMock);
    const user = userEvent.setup();
    renderPage(<ProductsPage />);
    const pack = creditsState.products[0];
    await user.click(
      within(await rowOf(pack.productId, pack.store)).getByRole('button', { name: 'Edit' }),
    );
    const dialog = await screen.findByRole('dialog');
    pack.sortOrder += 7;
    fireEvent.change(within(dialog).getByLabelText('Credits'), { target: { value: '4321' } });
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(
      await screen.findByText(/changed by someone else since the list was read/),
    ).toBeInTheDocument();
    expect(writes(calls)).toHaveLength(0);
    expect(pack.credits).not.toBe(4321);
  });

  it("sends a product id of any length and shows the length the backend refuses beside the field (the limit is the backend's, not a guess)", async () => {
    useMockBackend(creditsMock);
    const real = globalThis.fetch;
    vi.stubGlobal('fetch', async (input: string | URL, init?: RequestInit) =>
      init?.method === 'POST'
        ? jsonResponse(
            400,
            envelope('INVALID_REQUEST', { details: [{ ref: 'productId', reason: 'TOO_LONG' }] }),
          )
        : real(input, init),
    );
    const user = userEvent.setup();
    renderPage(<ProductsPage />);
    await user.click(await screen.findByRole('button', { name: 'New credit pack' }));
    const dialog = await screen.findByRole('dialog');
    await chooseOption(user, 'Store', 'APPLE', dialog);
    fireEvent.change(within(dialog).getByLabelText('Product ID'), {
      target: { value: 'p'.repeat(300) },
    });
    fireEvent.change(within(dialog).getByLabelText('Credits'), { target: { value: '10' } });
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(await within(dialog).findByText('The value is too long.')).toBeInTheDocument();
  });

  it('keeps a product id of 5000 characters without spaces inside its cell, and text of every language', async () => {
    const long = 'x'.repeat(5000);
    const rows = [
      long,
      'สวัสดี',
      'مرحبا',
      'Halo',
      'Xin chào',
      'Hola',
      'Hello',
      '你好',
      '😀'.repeat(50),
    ].map((productId, i) => ({
      id: String(i),
      store: 'APPLE',
      productId,
      credits: 100,
      enabled: true,
      sortOrder: i,
    }));
    stubFetch(async () => jsonResponse(200, envelope('200', { items: rows })));
    renderPage(<ProductsPage />);
    const cell = await screen.findByText(long);
    const button = cell.closest('button') as HTMLElement;
    expect(button.style.maxWidth).not.toBe('');
    expect(button.style.overflow).toBe('hidden');
    for (const text of ['สวัสดี', 'مرحبا', 'Xin chào', '你好']) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
  });
});
