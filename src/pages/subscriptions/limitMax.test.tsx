import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetConfigStore } from '../../../mock/_core/configStore';
import { resetStore } from '../../../mock/_core/store';
import { resetSubscriptionsStore } from '../../../mock/_core/subscriptionsData';
import * as configMock from '../../../mock/config.mock';
import * as subscriptionsMock from '../../../mock/subscriptions.mock';
import { signInAs, useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import { resetUmiStub, setTestAccess, setTestInitialState } from '../../../tests/stubs/umi-max';
import access from '../../access';
import EntitlementsPage from './entitlements';
import GatesPage from './gates';

// The largest value of a LIMIT feature comes from GET /meta (`entitlementLimitMax`, entitlement.limit_max
// in force). Without it the page checks no upper end and leaves it to the backend.

const signedIn = (meta: Record<string, unknown>) => {
  resetUmiStub();
  resetStore();
  resetConfigStore();
  resetSubscriptionsStore();
  signInAs('root');
  setTestAccess(
    access({ me: { superAdmin: true, permissions: [] } }) as unknown as Record<string, unknown>,
  );
  setTestInitialState({
    me: { id: '1', username: 'root', superAdmin: true, mustChangePassword: false, permissions: [] },
    meta,
  });
};
afterEach(() => vi.unstubAllGlobals());
beforeEach(() => signedIn({}));

const writes = <T extends { method: string }>(calls: T[]) =>
  calls.filter((c) => c.method !== 'GET');
const openDefault = async (key: string) => {
  const user = userEvent.setup();
  const cell = await screen.findByText(key, { selector: 'code' });
  await user.click(
    within(cell.closest('tr') as HTMLElement).getByRole('button', { name: 'Edit default' }),
  );
  const dialog = await screen.findByRole('dialog');
  await user.click(within(dialog).getByText('Value'));
  return { user, dialog };
};

describe('the largest value of a limit', { timeout: 30000 }, () => {
  it('says the largest value next to the number box, and does not send a value above it', async () => {
    signedIn({ entitlementLimitMax: 500 });
    const calls = useMockBackend(subscriptionsMock, configMock);
    renderPage(<GatesPage />);
    const { user, dialog } = await openDefault('call.daily_minutes');
    expect(within(dialog).getByText('Largest value: 500')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByRole('spinbutton'), { target: { value: '501' } });
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(
      await within(dialog).findByText('The value is outside the allowed range.'),
    ).toBeInTheDocument();
    expect(writes(calls)).toHaveLength(0);
  });

  it('sends the value that is the largest itself', async () => {
    signedIn({ entitlementLimitMax: 500 });
    const calls = useMockBackend(subscriptionsMock, configMock);
    renderPage(<GatesPage />);
    const { user, dialog } = await openDefault('call.daily_minutes');
    fireEvent.change(within(dialog).getByRole('spinbutton'), { target: { value: '500' } });
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(writes(calls)[0].body).toEqual({ mode: 'VALUE', value: 500 });
  });

  it('writes the largest value in the digits of the language', async () => {
    signedIn({ entitlementLimitMax: 1000000 });
    useMockBackend(subscriptionsMock, configMock);
    renderPage(<GatesPage />);
    const { dialog } = await openDefault('call.daily_minutes');
    expect(within(dialog).getByText('Largest value: 1,000,000')).toBeInTheDocument();
  });

  for (const meta of [{}, { entitlementLimitMax: 0 }, { entitlementLimitMax: '500' }]) {
    it(`checks no upper end and says none when meta has no value that can be right (the backend is the judge): ${JSON.stringify(meta)}`, async () => {
      signedIn(meta);
      const calls = useMockBackend(subscriptionsMock, configMock);
      renderPage(<GatesPage />);
      const { user, dialog } = await openDefault('call.daily_minutes');
      expect(within(dialog).queryByText(/Largest value/)).toBeNull();
      fireEvent.change(within(dialog).getByRole('spinbutton'), { target: { value: '999999' } });
      await user.click(within(dialog).getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(writes(calls)).toHaveLength(1));
    });
  }
});

describe('the largest value of a limit in the feature values of an entitlement', {
  timeout: 30000,
}, () => {
  const openFeatures = async () => {
    const user = userEvent.setup();
    const cell = await screen.findByText('basic', { selector: 'code' });
    await user.click(
      within(cell.closest('tr') as HTMLElement).getByRole('button', { name: 'Feature values' }),
    );
    const drawer = await screen.findByRole('dialog');
    const row = await within(drawer).findByTestId('feature-row-assets.avatar_max');
    await user.click(within(row).getByText('Value'));
    return { user, drawer, row };
  };

  it('refuses a value above the largest next to the switch and sends nothing', async () => {
    signedIn({ entitlementLimitMax: 10 });
    const calls = useMockBackend(subscriptionsMock);
    renderPage(<EntitlementsPage />);
    const { user, drawer, row } = await openFeatures();
    expect(within(row).getByText('Largest value: 10')).toBeInTheDocument();
    fireEvent.change(within(row).getByRole('spinbutton'), { target: { value: '11' } });
    await user.click(within(drawer).getByRole('button', { name: /Save/ }));
    expect(
      await within(row).findByText('The value is outside the allowed range.'),
    ).toBeInTheDocument();
    expect(writes(calls)).toHaveLength(0);
  });

  it('sends a value that is within it', async () => {
    signedIn({ entitlementLimitMax: 10 });
    const calls = useMockBackend(subscriptionsMock);
    renderPage(<EntitlementsPage />);
    const { user, drawer, row } = await openFeatures();
    fireEvent.change(within(row).getByRole('spinbutton'), { target: { value: '10' } });
    await user.click(within(drawer).getByRole('button', { name: /Save/ }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
  });
});
