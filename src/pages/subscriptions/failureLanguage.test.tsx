import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, it, vi } from 'vitest';
import { resetStore } from '../../../mock/_core/store';
import { resetSubscriptionsStore } from '../../../mock/_core/subscriptionsData';
import * as subscriptionsMock from '../../../mock/subscriptions.mock';
import {
  expectFailureFollowsLanguage,
  failRequests,
  renderWithLocaleSwitch,
} from '../../../tests/failureLanguage';
import { signInAs, useMockBackend } from '../../../tests/mockBackend';
import { resetUmiStub, setTestAccess } from '../../../tests/stubs/umi-max';
import access from '../../access';
import enUS from '../../locales/en-US';
import zhCN from '../../locales/zh-CN';
import { AccountEntitlementsPanel } from './AccountEntitlementsPanel';
import EntitlementsPage from './entitlements';
import GatesPage from './gates';
import ProductsPage from './products';
import { SubscriptionDrawer } from './SubscriptionDrawer';
import StatsPage from './stats';

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

describe('the failures of the subscription pages follow the language', { timeout: 60000 }, () => {
  it('the statistics whose read failed', async () => {
    useMockBackend(subscriptionsMock);
    failRequests(/GET .*subscriptions\/stats/);
    const view = renderWithLocaleSwitch(<StatsPage />);
    await expectFailureFollowsLanguage(view);
  });

  it('the switches that could not be read', async () => {
    useMockBackend(subscriptionsMock);
    failRequests(/GET .*feature-gates/);
    const view = renderWithLocaleSwitch(<GatesPage />);
    await expectFailureFollowsLanguage(view);
  });

  it('the products that could not be read', async () => {
    useMockBackend(subscriptionsMock);
    failRequests(/GET .*subscription-products/);
    const view = renderWithLocaleSwitch(<ProductsPage />);
    await expectFailureFollowsLanguage(view);
  });

  it('the entitlements that could not be read', async () => {
    useMockBackend(subscriptionsMock);
    failRequests(/GET .*entitlement-defs/);
    const view = renderWithLocaleSwitch(<EntitlementsPage />);
    await expectFailureFollowsLanguage(view);
  });

  it('the account entitlements that could not be read', async () => {
    useMockBackend(subscriptionsMock);
    failRequests(/GET .*accounts\/\w+\/entitlements/);
    const view = renderWithLocaleSwitch(<AccountEntitlementsPanel accountId="42" />);
    await expectFailureFollowsLanguage(view);
  });

  it('the subscription that could not be read', async () => {
    useMockBackend(subscriptionsMock);
    failRequests(/GET .*subscriptions\/\w+$/);
    const view = renderWithLocaleSwitch(<SubscriptionDrawer id="1" onClose={() => {}} />);
    await expectFailureFollowsLanguage(view);
  });

  it('the feature value that the backend refused, written next to its switch', async () => {
    useMockBackend(subscriptionsMock);
    const user = userEvent.setup();
    const view = renderWithLocaleSwitch(<EntitlementsPage />);
    const cell = await screen.findByText('basic', { selector: 'code' });
    await user.click(
      within(cell.closest('tr') as HTMLElement).getByRole('button', { name: 'Feature values' }),
    );
    const drawer = await screen.findByRole('dialog');
    const feature = (key: string) => within(drawer).getByTestId(`feature-row-${key}`);
    await within(drawer).findByTestId('feature-row-assets.avatar_max');
    await user.click(within(feature('assets.avatar_max')).getByText('Value'));
    fireEvent.change(within(feature('assets.avatar_max')).getByRole('spinbutton'), {
      target: { value: '4' },
    });
    await user.click(within(feature('memory.tier')).getByText('Value'));
    fireEvent.change(within(feature('memory.tier')).getByRole('textbox'), {
      target: { value: 'no-such-tier' },
    });
    await user.click(within(drawer).getByRole('button', { name: /Save/ }));
    await expectFailureFollowsLanguage(view, {
      words: { en: enUS['reason.OUT_OF_RANGE'], zh: zhCN['reason.OUT_OF_RANGE'] },
    });
  });
});
