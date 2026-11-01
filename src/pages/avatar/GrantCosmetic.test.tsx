import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ACCOUNT, avatarState } from '../../../mock/_core/avatarData';
import avatarMock from '../../../mock/avatar.mock';
import { envelope, jsonResponse } from '../../../tests/httpStubs';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import { setTestAccess } from '../../../tests/stubs/umi-max';
import access from '../../access';
import { GrantCosmeticButton } from './GrantCosmetic';
import { chooseOption, dialogsClosed, signIn, writesOf } from './testSetup';

const backend = () => useMockBackend({ default: avatarMock });

/** The cosmetic list is open to the right to give (backend reply 2, point 9); this administrator has only that. */
beforeEach(() => signIn('root'));

const mount = (props: { ownedItemIds?: string[]; onGranted?: () => void } = {}) =>
  renderPage(
    <GrantCosmeticButton
      accountId={ACCOUNT.empty}
      onGranted={props.onGranted ?? (() => {})}
      ownedItemIds={props.ownedItemIds}
    />,
  );

const openDialog = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('button', { name: 'Give a cosmetic' }));
  return screen.findByRole('dialog');
};

describe('giving a cosmetic to an account', { timeout: 60000 }, () => {
  it('shows the button only to COSMETIC:GRANT', async () => {
    backend();
    setTestAccess(access({ me: { superAdmin: false, permissions: ['USER:VIEW'] } }));
    const view = mount();
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole('button', { name: 'Give a cosmetic' })).not.toBeInTheDocument();
    view.unmount();
    setTestAccess(access({ me: { superAdmin: false, permissions: ['COSMETIC:GRANT'] } }));
    mount();
    expect(await screen.findByRole('button', { name: 'Give a cosmetic' })).toBeInTheDocument();
  });

  it('lists the items from GET /cosmetics, the ones off sale marked and the ones the account owns not choosable', async () => {
    const calls = backend();
    const user = userEvent.setup();
    mount({ ownedItemIds: ['3'] });
    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole('combobox', { name: 'Item' }));
    expect(
      (
        await screen.findAllByText(/outfit_blue_suit/, {
          selector: '.ant-select-item-option-content',
        })
      ).length,
    ).toBeGreaterThan(0);
    const owned = (
      await screen.findAllByText(/outfit_red_dress/, {
        selector: '.ant-select-item-option-content',
      })
    )[0].closest('.ant-select-item');
    expect(owned?.className).toContain('ant-select-item-option-disabled');
    expect(
      screen.getAllByText(/bg_night_city.*Off sale/, {
        selector: '.ant-select-item-option-content',
      }).length,
    ).toBeGreaterThan(0);
    expect(calls.find((c) => c.url.startsWith('/api/admin/cosmetics'))?.url).toBe(
      '/api/admin/cosmetics?page=1&pageSize=200',
    );
  });

  it('also lists an item that is past the first 200 of the catalog', async () => {
    backend();
    const real = globalThis.fetch;
    const item = (n: number) => ({
      id: `c${n}`,
      key: `item_${n}`,
      kind: 'OUTFIT',
      names: { en: `Item ${n}` },
      enabled: true,
    });
    vi.stubGlobal('fetch', async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (!url.startsWith('/api/admin/cosmetics?')) return real(input, init);
      const page = Number(new URL(url, 'http://x').searchParams.get('page'));
      const items = page === 1 ? Array.from({ length: 200 }, (_, n) => item(n)) : [item(200)];
      return jsonResponse(200, envelope('200', { items, total: 201 }));
    });
    const user = userEvent.setup();
    mount();
    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole('combobox', { name: 'Item' }));
    await user.type(within(dialog).getByRole('combobox', { name: 'Item' }), 'item_200');
    expect(
      (await screen.findAllByText(/item_200/, { selector: '.ant-select-item-option-content' }))
        .length,
    ).toBeGreaterThan(0);
    vi.unstubAllGlobals();
  });

  it('sends itemId and the trimmed reason, tells the caller, and closes', async () => {
    const calls = backend();
    const user = userEvent.setup();
    const onGranted = vi.fn();
    mount({ onGranted });
    const dialog = await openDialog(user);
    await chooseOption(user, 'Item', /outfit_blue_suit/, dialog);
    fireEvent.change(within(dialog).getByLabelText('Reason'), {
      target: { value: ` Compensation ${String.fromCharCode(0x3000)}` },
    });
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0]).toMatchObject({
      method: 'POST',
      url: `/api/admin/accounts/${ACCOUNT.empty}/cosmetics`,
      body: { itemId: '4', reason: 'Compensation' },
    });
    await waitFor(() => expect(onGranted).toHaveBeenCalledTimes(1));
    await dialogsClosed();
  });

  it('requires a reason of 1 to 500 code points (500 emoji pass, 501 Arabic letters and spaces do not) and an item', async () => {
    const calls = backend();
    const user = userEvent.setup();
    mount();
    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(await within(dialog).findByText('Choose an item.')).toBeInTheDocument();
    expect(within(dialog).getByText('Enter a reason')).toBeInTheDocument();
    await chooseOption(user, 'Item', /outfit_blue_suit/, dialog);
    fireEvent.change(within(dialog).getByLabelText('Reason'), {
      target: { value: 'ب'.repeat(501) },
    });
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(await within(dialog).findByText(/1.*500/)).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
    fireEvent.change(within(dialog).getByLabelText('Reason'), {
      target: { value: '😀'.repeat(500) },
    });
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
  });

  it('sends once when Submit is pressed twice at once', async () => {
    const calls = backend();
    const user = userEvent.setup();
    mount();
    const dialog = await openDialog(user);
    await chooseOption(user, 'Item', /outfit_blue_suit/, dialog);
    fireEvent.change(within(dialog).getByLabelText('Reason'), { target: { value: 'Gift' } });
    const submit = within(dialog).getByRole('button', { name: 'Submit' });
    fireEvent.click(submit);
    fireEvent.click(submit);
    await new Promise((r) => setTimeout(r, 200));
    expect(writesOf(calls)).toHaveLength(1);
  });

  it('shows the backend text and keeps the dialog open when the account owns the item already', async () => {
    backend();
    avatarState.accountCosmetics.set(ACCOUNT.empty, [
      {
        itemId: '4',
        itemKey: 'outfit_blue_suit',
        source: 'CREDITS',
        creditLedgerId: '7',
        grantedAt: new Date().toISOString(),
      },
    ]);
    const user = userEvent.setup();
    const onGranted = vi.fn();
    mount({ onGranted });
    const dialog = await openDialog(user);
    await chooseOption(user, 'Item', /outfit_blue_suit/, dialog);
    fireEvent.change(within(dialog).getByLabelText('Reason'), { target: { value: 'Gift' } });
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(
      await within(dialog).findAllByText('An item with the same unique value already exists.'),
    ).not.toHaveLength(0);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(onGranted).not.toHaveBeenCalled();
  });

  it('with a 403 on the list, disables the choice, says which permission lists the items, and does not break', async () => {
    // The interface thinks this administrator may give (so the button shows); the backend says it may not list.
    signIn('support');
    setTestAccess(access({ me: { superAdmin: false, permissions: ['COSMETIC:GRANT'] } }));
    backend();
    const user = userEvent.setup();
    mount();
    const dialog = await openDialog(user);
    expect(
      await within(dialog).findByText(
        'COSMETIC:MANAGE or COSMETIC:GRANT is needed to list the items, so none can be chosen.',
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('combobox', { name: 'Item' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Submit' })).toBeDisabled();
  });

  it('shows another failure of the list with a retry', async () => {
    const real = globalThis.fetch;
    backend();
    let fail = true;
    vi.stubGlobal('fetch', async (input: string | URL, init?: RequestInit) =>
      fail && String(input).startsWith('/api/admin/cosmetics')
        ? jsonResponse(500, envelope('INTERNAL_ERROR', null, 'boom'))
        : real(input, init),
    );
    const user = userEvent.setup();
    mount();
    const dialog = await openDialog(user);
    expect(await within(dialog).findByText(/Failed to load/)).toBeInTheDocument();
    fail = false;
    await user.click(within(dialog).getByRole('button', { name: 'Retry' }));
    await user.click(within(dialog).getByRole('combobox', { name: 'Item' }));
    expect(
      (
        await screen.findAllByText(/outfit_blue_suit/, {
          selector: '.ant-select-item-option-content',
        })
      ).length,
    ).toBeGreaterThan(0);
    vi.unstubAllGlobals();
  });
});
