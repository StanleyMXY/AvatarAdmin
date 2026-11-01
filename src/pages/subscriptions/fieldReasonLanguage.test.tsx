import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, it, vi } from 'vitest';
import { resetStore } from '../../../mock/_core/store';
import { resetSubscriptionsStore } from '../../../mock/_core/subscriptionsData';
import * as subscriptionsMock from '../../../mock/subscriptions.mock';
import {
  expectFieldReasonsFollowLanguage,
  refuseRequests,
  renderWithLocaleSwitch,
} from '../../../tests/failureLanguage';
import { signInAs, useMockBackend } from '../../../tests/mockBackend';
import { resetUmiStub, setTestAccess } from '../../../tests/stubs/umi-max';
import access from '../../access';
import enUS from '../../locales/en-US';
import zhCN from '../../locales/zh-CN';
import EntitlementsPage from './entitlements';
import ProductsPage from './products';

beforeEach(() => {
  resetUmiStub();
  resetStore();
  resetSubscriptionsStore();
  signInAs('root');
  setTestAccess(
    access({ me: { superAdmin: true, permissions: [] } }) as unknown as Record<string, unknown>,
  );
});
afterEach(() => vi.unstubAllGlobals());

async function choose(
  user: ReturnType<typeof userEvent.setup>,
  scope: HTMLElement,
  label: string,
  option: RegExp | string,
) {
  await user.click(within(scope).getByLabelText(label));
  await user.click(await screen.findByTitle(option));
}

describe('the reasons under the fields of the subscription dialogs follow the language', {
  timeout: 60000,
}, () => {
  it('a product that is already mapped (a check of the page itself, before any request)', async () => {
    useMockBackend(subscriptionsMock);
    const user = userEvent.setup();
    const view = renderWithLocaleSwitch(<ProductsPage />);
    await user.click(await screen.findByRole('button', { name: 'New product' }));
    const dialog = await screen.findByRole('dialog');
    await choose(user, dialog, 'Store', 'APPLE');
    fireEvent.change(within(dialog).getByLabelText('Product ID'), {
      target: { value: 'avatar.premium.monthly' },
    });
    await choose(user, dialog, 'Entitlement', /\(premium\)$/);
    fireEvent.change(within(dialog).getByLabelText('Sort order'), { target: { value: '1' } });
    await user.click(within(dialog).getByRole('button', { name: /Save/ }));
    await expectFieldReasonsFollowLanguage(view, {
      fields: 1,
      words: {
        en: enUS['subscriptions.products.exists'],
        zh: zhCN['subscriptions.products.exists'],
      },
    });
  });

  it('a product whose sort order the backend refused', async () => {
    useMockBackend(subscriptionsMock);
    refuseRequests(
      (path, method) => method !== 'GET' && path.includes('subscription-products'),
      [{ ref: 'sortOrder', reason: 'TOO_LONG' }],
    );
    const user = userEvent.setup();
    const view = renderWithLocaleSwitch(<ProductsPage />);
    await user.click(await screen.findByRole('button', { name: 'New product' }));
    const dialog = await screen.findByRole('dialog');
    await choose(user, dialog, 'Store', 'APPLE');
    fireEvent.change(within(dialog).getByLabelText('Product ID'), {
      target: { value: 'avatar.vip.weekly' },
    });
    await choose(user, dialog, 'Entitlement', /\(basic\)$/);
    fireEvent.change(within(dialog).getByLabelText('Sort order'), { target: { value: '9' } });
    await user.click(within(dialog).getByRole('button', { name: /Save/ }));
    await expectFieldReasonsFollowLanguage(view, { fields: 1 });
  });

  it('an entitlement whose priority is taken (409 naming the field)', async () => {
    useMockBackend(subscriptionsMock);
    const user = userEvent.setup();
    const view = renderWithLocaleSwitch(<EntitlementsPage />);
    await user.click(await screen.findByRole('button', { name: 'New entitlement' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Key'), { target: { value: 'gold' } });
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Gold' } });
    fireEvent.change(within(dialog).getByLabelText('Priority'), { target: { value: '20' } });
    await user.click(within(dialog).getByRole('button', { name: /Save/ }));
    await expectFieldReasonsFollowLanguage(view, {
      fields: 1,
      words: { en: enUS['error.DUPLICATE_RESOURCE'], zh: zhCN['error.DUPLICATE_RESOURCE'] },
    });
  });

  it('an entitlement whose name the backend refused', async () => {
    useMockBackend(subscriptionsMock);
    refuseRequests(
      (path, method) => method !== 'GET' && path.includes('entitlement-defs'),
      [{ ref: 'name', reason: 'TOO_LONG' }],
    );
    const user = userEvent.setup();
    const view = renderWithLocaleSwitch(<EntitlementsPage />);
    await user.click(await screen.findByRole('button', { name: 'New entitlement' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Key'), { target: { value: 'gold_vn' } });
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Vàng — Gói' } });
    fireEvent.change(within(dialog).getByLabelText('Priority'), { target: { value: '50' } });
    await user.click(within(dialog).getByRole('button', { name: /Save/ }));
    await expectFieldReasonsFollowLanguage(view, { fields: 1 });
  });
});
