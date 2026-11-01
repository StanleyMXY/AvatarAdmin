import './testSetup';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
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
import { AccountEntitlementsPanel } from './AccountEntitlementsPanel';

const ACCOUNT = '10000000001';

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

const writes = <T extends { method: string }>(calls: T[]) =>
  calls.filter((c) => c.method !== 'GET');
const effectiveRow = async (key: string) => {
  const cell = await screen.findByText(key, { selector: '[data-testid="effective-table"] code' });
  return cell.closest('tr') as HTMLElement;
};
const entitlementRows = () =>
  [
    ...document.querySelectorAll('[data-testid="entitlement-table"] tbody tr.ant-table-row'),
  ] as HTMLElement[];
const entitlementRow = (id: string) =>
  entitlementRows().find((r) => r.getAttribute('data-row-key') === id) as HTMLElement;

async function pick(
  user: ReturnType<typeof userEvent.setup>,
  scope: HTMLElement,
  label: string,
  option: RegExp | string,
) {
  await user.click(within(scope).getByLabelText(label));
  await user.click(await screen.findByTitle(option));
}

describe('the effective values', { timeout: 30000 }, () => {
  it('has one row for each switch with the value in force and where it comes from', async () => {
    useMockBackend(subscriptionsMock);
    renderPage(<AccountEntitlementsPanel accountId={ACCOUNT} />);
    await effectiveRow('call.monthly_minutes');
    expect(
      document.querySelectorAll('[data-testid="effective-table"] tbody tr.ant-table-row'),
    ).toHaveLength(15);
    // 600 from the premium entitlement
    const monthly = await effectiveRow('call.monthly_minutes');
    expect(within(monthly).getByText('600')).toBeInTheDocument();
    expect(within(monthly).getByText('Entitlement')).toBeInTheDocument();
    expect(within(monthly).getByText('premium', { selector: 'code' })).toBeInTheDocument();
    // memory.tier has no entitlement value, so the default applies
    const tier = await effectiveRow('memory.tier');
    expect(within(tier).getByText('default', { selector: 'span' })).toBeInTheDocument();
    expect(within(tier).getByText('Default')).toBeInTheDocument();
    // call.lifetime_minutes has no value at all
    const lifetime = await effectiveRow('call.lifetime_minutes');
    expect(within(lifetime).getByText('Not configured')).toBeInTheDocument();
    expect(within(lifetime).getByText('None')).toBeInTheDocument();
    // a limit set to "no limit" by an entitlement
    expect(
      within(await effectiveRow('chat.daily_messages')).getByText('No limit'),
    ).toBeInTheDocument();
  });

  it('shows a failed read, and an account that does not exist, with a retry', async () => {
    useMockBackend(subscriptionsMock);
    renderPage(<AccountEntitlementsPanel accountId="42" />);
    expect(await screen.findByText(/Failed to load/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});

const OTHER = '10000000002';

function Switcher() {
  const [id, setId] = useState(ACCOUNT);
  return (
    <>
      <button type="button" onClick={() => setId(OTHER)}>
        other account
      </button>
      <AccountEntitlementsPanel accountId={id} />
    </>
  );
}

describe('switching to another account', { timeout: 30000 }, () => {
  it('shows the rows of the account now shown when the answer for the account shown before arrives late', async () => {
    useMockBackend(subscriptionsMock);
    const expected = subscriptionsState().accountEntitlements.filter(
      (e) => e.accountId === OTHER,
    ).length;
    expect(expected).not.toBe(
      subscriptionsState().accountEntitlements.filter((e) => e.accountId === ACCOUNT).length,
    );
    const held = holdRequests((url) => url.endsWith(`/accounts/${ACCOUNT}/entitlements`));
    renderPage(<Switcher />);
    await waitFor(() => expect(held.started()).toBe(1));
    fireEvent.click(screen.getByRole('button', { name: 'other account' }));
    await waitFor(() => expect(entitlementRows()).toHaveLength(expected));
    held.release();
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(entitlementRows()).toHaveLength(expected);
  });
});

describe('the entitlement rows', { timeout: 30000 }, () => {
  it('lists every entitlement of the account, newest start first, with source and status', async () => {
    useMockBackend(subscriptionsMock);
    renderPage(<AccountEntitlementsPanel accountId={ACCOUNT} />);
    await waitFor(() => expect(entitlementRows()).toHaveLength(4));
    expect(entitlementRows().map((r) => r.getAttribute('data-row-key'))).toEqual([
      '7002',
      '7004',
      '7001',
      '7003',
    ]);
    expect(within(entitlementRow('7001')).getByText('Store')).toBeInTheDocument();
    expect(within(entitlementRow('7002')).getByText('Limited-time grant')).toBeInTheDocument();
    expect(within(entitlementRow('7002')).getByText('Active')).toBeInTheDocument();
    expect(within(entitlementRow('7003')).getByText('Expired')).toBeInTheDocument();
    expect(within(entitlementRow('7004')).getByText('Revoked')).toBeInTheDocument();
    // the granter by name, and the reason in the language it was written in
    expect(within(entitlementRow('7002')).getByText('root')).toBeInTheDocument();
    expect(within(entitlementRow('7002')).getByText('مرحبا بك في التطبيق')).toBeInTheDocument();
  });

  it('shows Revoke only on a limited-time grant that is active', async () => {
    useMockBackend(subscriptionsMock);
    renderPage(<AccountEntitlementsPanel accountId={ACCOUNT} />);
    await waitFor(() => expect(entitlementRows()).toHaveLength(4));
    expect(screen.getAllByRole('button', { name: 'Revoke' })).toHaveLength(1);
    expect(
      within(entitlementRow('7002')).getByRole('button', { name: 'Revoke' }),
    ).toBeInTheDocument();
    for (const id of ['7001', '7003', '7004'])
      expect(within(entitlementRow(id)).queryByRole('button', { name: 'Revoke' })).toBeNull();
  });

  it('shows neither Revoke nor Grant without SUBSCRIPTION:GRANT', async () => {
    as(['SUBSCRIPTION:VIEW', 'SUBSCRIPTION:CONFIG']);
    useMockBackend(subscriptionsMock);
    renderPage(<AccountEntitlementsPanel accountId={ACCOUNT} />);
    await waitFor(() => expect(entitlementRows()).toHaveLength(4));
    expect(screen.queryByRole('button', { name: 'Revoke' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Grant entitlement' })).toBeNull();
  });

  it('shows both with SUBSCRIPTION:GRANT', async () => {
    as(['SUBSCRIPTION:VIEW', 'SUBSCRIPTION:GRANT']);
    useMockBackend(subscriptionsMock);
    renderPage(<AccountEntitlementsPanel accountId={ACCOUNT} />);
    await waitFor(() => expect(entitlementRows()).toHaveLength(4));
    expect(screen.getAllByRole('button', { name: 'Revoke' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Grant entitlement' })).toBeInTheDocument();
  });

  it('keeps a reason of 5000 characters without spaces inside its cell', async () => {
    subscriptionsState().accountEntitlements[1].reason = 'ก'.repeat(5000);
    useMockBackend(subscriptionsMock);
    renderPage(<AccountEntitlementsPanel accountId={ACCOUNT} />);
    await waitFor(() => expect(entitlementRows()).toHaveLength(4));
    const clamps = [
      ...document.querySelectorAll('[data-testid="entitlement-table"] button[data-lines]'),
    ] as HTMLElement[];
    expect(clamps.length).toBeGreaterThan(0);
    for (const c of clamps) expect(c.style.overflowWrap).toBe('anywhere');
  });
});

describe('revoking', { timeout: 30000 }, () => {
  it('asks inline first, then sends one request, and the row becomes Revoked without a Revoke button', async () => {
    const calls = useMockBackend(subscriptionsMock);
    const user = userEvent.setup();
    renderPage(<AccountEntitlementsPanel accountId={ACCOUNT} />);
    await waitFor(() => expect(entitlementRows()).toHaveLength(4));
    await user.click(within(entitlementRow('7002')).getByRole('button', { name: 'Revoke' }));
    expect(writes(calls)).toHaveLength(0);
    expect(
      await screen.findByText(
        'Revoke this limited-time entitlement? The store subscription is not touched.',
      ),
    ).toBeInTheDocument();
    const ok = screen.getByRole('button', { name: /OK|确 定|确定/ });
    fireEvent.click(ok);
    fireEvent.click(ok);
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    await new Promise((r) => setTimeout(r, 100));
    expect(writes(calls)).toHaveLength(1);
    expect(writes(calls)[0]).toMatchObject({
      method: 'POST',
      url: '/api/admin/promo-entitlements/7002/revoke',
    });
    await waitFor(() =>
      expect(within(entitlementRow('7002')).getByText('Revoked')).toBeInTheDocument(),
    );
    expect(screen.queryByRole('button', { name: 'Revoke' })).toBeNull();
  });

  it('says why when the backend refuses (409: someone revoked it first)', async () => {
    const calls = useMockBackend(subscriptionsMock);
    const user = userEvent.setup();
    renderPage(<AccountEntitlementsPanel accountId={ACCOUNT} />);
    await waitFor(() => expect(entitlementRows()).toHaveLength(4));
    (
      subscriptionsState().accountEntitlements.find((r) => r.id === '7002') as { revokedAt: string }
    ).revokedAt = new Date().toISOString();
    await user.click(within(entitlementRow('7002')).getByRole('button', { name: 'Revoke' }));
    fireEvent.click(await screen.findByRole('button', { name: /OK|确 定|确定/ }));
    expect(
      await screen.findByText('The current state of the item does not allow this action.'),
    ).toBeInTheDocument();
    expect(writes(calls)).toHaveLength(1);
  });

  it('does not send again when the token ended during the write', async () => {
    const payload = {
      effective: [],
      entitlements: [
        {
          id: '1',
          accountId: ACCOUNT,
          entitlementKey: 'plus_th',
          entitlementName: 'Plus',
          source: 'PROMO',
          subscriptionId: null,
          startsAt: '2026-10-01T00:00:00Z',
          expiresAt: '2099-01-01T00:00:00Z',
          grantedBy: '1',
          grantedByUsername: 'root',
          reason: 'r',
          revokedAt: null,
          expiryHandledAt: null,
          status: 'ACTIVE',
        },
      ],
    };
    const calls = stubFetch(async ({ init }) =>
      (init.method ?? 'GET') === 'GET'
        ? jsonResponse(200, envelope('200', payload))
        : jsonResponse(401, envelope('ADMIN_INVALID_TOKEN')),
    );
    const user = userEvent.setup();
    renderPage(<AccountEntitlementsPanel accountId={ACCOUNT} />);
    await waitFor(() => expect(entitlementRows()).toHaveLength(1));
    await user.click(within(entitlementRows()[0]).getByRole('button', { name: 'Revoke' }));
    fireEvent.click(await screen.findByRole('button', { name: /OK|确 定|确定/ }));
    await waitFor(() => expect(calls.filter((c) => c.init.method === 'POST')).toHaveLength(1));
    await new Promise((r) => setTimeout(r, 100));
    expect(calls.filter((c) => c.init.method === 'POST')).toHaveLength(1);
  });
});

describe('granting a limited-time entitlement', { timeout: 30000 }, () => {
  const open = async () => {
    const user = userEvent.setup();
    renderPage(<AccountEntitlementsPanel accountId={ACCOUNT} />);
    await waitFor(() => expect(entitlementRows()).toHaveLength(4));
    await user.click(screen.getByRole('button', { name: 'Grant entitlement' }));
    return { user, dialog: await screen.findByRole('dialog') };
  };
  const fill = async (
    user: ReturnType<typeof userEvent.setup>,
    dialog: HTMLElement,
    days: string,
    reason: string,
  ) => {
    await pick(user, dialog, 'Entitlement', /\(plus_th\)$/);
    fireEvent.change(within(dialog).getByLabelText('Duration (days)'), { target: { value: days } });
    fireEvent.change(within(dialog).getByLabelText('Reason'), { target: { value: reason } });
  };

  it('offers the entitlements from the server by name and key, and sends the choice, the days and the trimmed reason', async () => {
    const calls = useMockBackend(subscriptionsMock);
    const { user, dialog } = await open();
    await user.click(within(dialog).getByLabelText('Entitlement'));
    for (const key of ['basic', 'premium', 'plus_th', 'vip_ar'])
      expect(await screen.findByTitle(new RegExp(`\\(${key}\\)$`))).toBeInTheDocument();
    await user.click(screen.getByTitle(/\(plus_th\)$/));
    fireEvent.change(within(dialog).getByLabelText('Duration (days)'), { target: { value: '14' } });
    fireEvent.change(within(dialog).getByLabelText('Reason'), {
      target: { value: '  ทดลองใช้ฟรี 14 วัน 😀  ' },
    });
    await user.click(within(dialog).getByRole('button', { name: /Submit|提 交/ }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(writes(calls)[0]).toMatchObject({
      method: 'POST',
      url: `/api/admin/accounts/${ACCOUNT}/promo-entitlements`,
      body: { entitlementKey: 'plus_th', durationDays: 14, reason: 'ทดลองใช้ฟรี 14 วัน 😀' },
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(entitlementRows()).toHaveLength(5));
  });

  it('asks for the entitlement, the days and the reason before sending', async () => {
    const calls = useMockBackend(subscriptionsMock);
    const { user, dialog } = await open();
    await user.click(within(dialog).getByRole('button', { name: /Submit|提 交/ }));
    await waitFor(() =>
      expect(within(dialog).getAllByText('It must not be empty.')).toHaveLength(2),
    );
    expect(within(dialog).getByText('Enter a reason')).toBeInTheDocument();
    expect(writes(calls)).toHaveLength(0);
  });

  it('counts the reason in code points after trimming: 500 emoji is allowed, 501 is not, spaces do not count', async () => {
    const calls = useMockBackend(subscriptionsMock);
    const { user, dialog } = await open();
    await fill(user, dialog, '3', `${'😀'.repeat(501)}`);
    await user.click(within(dialog).getByRole('button', { name: /Submit|提 交/ }));
    expect(await within(dialog).findByText(/1 .* 500/)).toBeInTheDocument();
    expect(writes(calls)).toHaveLength(0);
    fireEvent.change(within(dialog).getByLabelText('Reason'), {
      target: { value: `   ${'😀'.repeat(500)}   ` },
    });
    await user.click(within(dialog).getByRole('button', { name: /Submit|提 交/ }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect((writes(calls)[0].body as { reason: string }).reason).toBe('😀'.repeat(500));
  });

  it('refuses a number of days that is not a whole number of 1 or more, without sending', async () => {
    const calls = useMockBackend(subscriptionsMock);
    const { user, dialog } = await open();
    await fill(user, dialog, '0', 'ok');
    await user.click(within(dialog).getByRole('button', { name: /Submit|提 交/ }));
    expect(
      await within(dialog).findByText('The value is outside the allowed range.'),
    ).toBeInTheDocument();
    expect(writes(calls)).toHaveLength(0);
  });

  it('shows the refusal of the backend and keeps the dialog open', async () => {
    const calls = useMockBackend(subscriptionsMock);
    const { user, dialog } = await open();
    await fill(user, dialog, '99999', 'ok');
    await user.click(within(dialog).getByRole('button', { name: /Submit|提 交/ }));
    expect(
      await within(dialog).findByText('The value is outside the allowed range.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(writes(calls)).toHaveLength(1);
  });

  it('sends one request however many times Submit is clicked, also while the server is slow', async () => {
    const defs = [{ key: 'plus_th', name: 'Plus', priority: 1, features: [] }];
    const calls = stubFetch(async ({ url, init }) => {
      if ((init.method ?? 'GET') === 'POST') {
        await new Promise((r) => setTimeout(r, 300));
        return jsonResponse(200, envelope('200', { id: '7100' }));
      }
      if (url.includes('entitlement-defs'))
        return jsonResponse(200, envelope('200', { items: defs }));
      return jsonResponse(200, envelope('200', { effective: [], entitlements: [] }));
    });
    const user = userEvent.setup();
    renderPage(<AccountEntitlementsPanel accountId={ACCOUNT} />);
    await user.click(await screen.findByRole('button', { name: 'Grant entitlement' }));
    const dialog = await screen.findByRole('dialog');
    await fill(user, dialog, '5', 'ok');
    const submit = within(dialog).getByRole('button', { name: /Submit|提 交/ });
    fireEvent.click(submit);
    await new Promise((r) => setTimeout(r, 50));
    fireEvent.click(submit);
    fireEvent.click(submit);
    await new Promise((r) => setTimeout(r, 500));
    expect(calls.filter((c) => c.init.method === 'POST')).toHaveLength(1);
  });

  it('does not send again when the token ended during the write', async () => {
    const defs = [{ key: 'plus_th', name: 'Plus', priority: 1, features: [] }];
    const calls = stubFetch(async ({ url, init }) => {
      if ((init.method ?? 'GET') !== 'GET')
        return jsonResponse(401, envelope('ADMIN_INVALID_TOKEN'));
      if (url.includes('entitlement-defs'))
        return jsonResponse(200, envelope('200', { items: defs }));
      return jsonResponse(200, envelope('200', { effective: [], entitlements: [] }));
    });
    const user = userEvent.setup();
    renderPage(<AccountEntitlementsPanel accountId={ACCOUNT} />);
    await user.click(await screen.findByRole('button', { name: 'Grant entitlement' }));
    const dialog = await screen.findByRole('dialog');
    await fill(user, dialog, '5', 'ok');
    await user.click(within(dialog).getByRole('button', { name: /Submit|提 交/ }));
    await waitFor(() => expect(calls.filter((c) => c.init.method === 'POST')).toHaveLength(1));
    await new Promise((r) => setTimeout(r, 100));
    expect(calls.filter((c) => c.init.method === 'POST')).toHaveLength(1);
  });
});
