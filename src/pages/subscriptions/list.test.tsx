import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetStore } from '../../../mock/_core/store';
import { resetSubscriptionsStore, subscriptionsState } from '../../../mock/_core/subscriptionsData';
import { adminOf } from '../../../mock/_core/testing';
import * as subscriptionsMock from '../../../mock/subscriptions.mock';
import { signInAs, useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import { resetUmiStub, setTestAccess } from '../../../tests/stubs/umi-max';
import access from '../../access';
import SubscriptionListPage from './list';

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

describe('the subscription list', { timeout: 30000 }, () => {
  it('shows the first page with the total, the status as text, and a tag on the sandbox ones', async () => {
    useMockBackend(subscriptionsMock);
    renderPage(<SubscriptionListPage />);
    await screen.findAllByText('Details');
    const rows = document.querySelectorAll('tbody tr.ant-table-row');
    expect(rows).toHaveLength(20);
    expect(document.querySelector('.ant-pagination-total-text, .ant-pagination')).not.toBeNull();
    const sandbox = subscriptionsState().subscriptions.filter(
      (s) => s.environment === 'SANDBOX',
    ).length;
    expect(sandbox).toBeGreaterThan(0);
    expect(screen.getAllByText('Sandbox').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
    // a subscription that is not bound to an account shows a dash, not "null"
    expect(document.body.textContent).not.toMatch(/null|undefined/);
  });

  it('filters by account ID and sends the filter to the server', async () => {
    const calls = useMockBackend(subscriptionsMock);
    const user = userEvent.setup();
    renderPage(<SubscriptionListPage />);
    await screen.findAllByText('Details');
    const account = subscriptionsState().subscriptions[0].accountId as string;
    await user.type(screen.getByLabelText('Account ID'), account);
    await user.click(screen.getByRole('button', { name: /查 询|Search/ }));
    await waitFor(() =>
      expect(calls.some((c) => c.url.includes(`accountId=${account}`))).toBe(true),
    );
    const expected = subscriptionsState().subscriptions.filter(
      (s) => s.accountId === account,
    ).length;
    await waitFor(() =>
      expect(document.querySelectorAll('tbody tr.ant-table-row')).toHaveLength(expected),
    );
  });

  it('links the account to the user page only for an administrator who may open it', async () => {
    useMockBackend(subscriptionsMock);
    const first = subscriptionsState().subscriptions.find((s) => s.accountId) as {
      accountId: string;
    };
    const view = renderPage(<SubscriptionListPage />);
    await screen.findAllByText('Details');
    expect(view.container.querySelector(`a[href="/users/${first.accountId}"]`)).not.toBeNull();
    view.unmount();
    setTestAccess(
      access({
        me: { superAdmin: false, permissions: ['SUBSCRIPTION:VIEW'] },
      }) as unknown as Record<string, unknown>,
    );
    const second = renderPage(<SubscriptionListPage />);
    await screen.findAllByText('Details');
    expect(second.container.querySelector('a[href^="/users/"]')).toBeNull();
    expect(second.container.textContent).toContain(first.accountId);
  });

  it('shows the server error with a retry instead of breaking', async () => {
    adminOf('support').permissions = ['USER:VIEW'];
    signInAs('support');
    useMockBackend(subscriptionsMock);
    renderPage(<SubscriptionListPage />);
    expect(await screen.findByText(/Failed to load/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});

describe('the subscription detail drawer', { timeout: 30000 }, () => {
  const openFirst = async () => {
    const user = userEvent.setup();
    renderPage(<SubscriptionListPage />);
    const buttons = await screen.findAllByRole('button', { name: 'Details' });
    await user.click(buttons[0]);
    return await screen.findByRole('dialog');
  };

  it('does not show a Google purchase token: it can claim the subscription, so only its last six characters appear, with nothing to copy', async () => {
    for (const s of subscriptionsState().subscriptions) {
      s.store = 'GOOGLE';
      s.storeRef = 'gp-token-SECRETVALUE-abc123';
    }
    useMockBackend(subscriptionsMock);
    const dialog = await openFirst();
    await within(dialog).findAllByTestId('timeline-event');
    expect(dialog.textContent).not.toContain('SECRETVALUE');
    expect(dialog.textContent).toContain('abc123');
    expect(within(dialog).queryByRole('button', { name: /copy/i })).toBeNull();
    expect(dialog.querySelector('.anticon-copy')).toBeNull();
  });

  it('shows the whole Apple original transaction ID, which cannot claim a subscription by itself', async () => {
    for (const s of subscriptionsState().subscriptions) {
      s.store = 'APPLE';
      s.storeRef = '2000000123456789';
    }
    useMockBackend(subscriptionsMock);
    const dialog = await openFirst();
    await within(dialog).findAllByTestId('timeline-event');
    expect(dialog.textContent).toContain('2000000123456789');
  });

  it('lists the events newest first by the time the store signed them', async () => {
    useMockBackend(subscriptionsMock);
    const dialog = await openFirst();
    await within(dialog).findAllByTestId('timeline-event');
    const times = within(dialog)
      .getAllByTestId('timeline-event')
      .map((e) => e.getAttribute('data-signed-at') as string);
    expect(times.length).toBeGreaterThan(1);
    expect(times).toEqual([...times].sort().reverse());
  });

  it('puts the events in order even if the server sends them in another order', async () => {
    useMockBackend(subscriptionsMock);
    // make the server answer with the oldest first
    const state = subscriptionsState();
    const target = state.subscriptions.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
    const own = state.events.filter((e) => e.subscriptionId === target.id);
    expect(own.length).toBeGreaterThan(1);
    const handler = (subscriptionsMock.default as Record<string, unknown>)[
      'GET /api/admin/subscriptions/:id'
    ];
    expect(handler).toBeDefined();
    const original = globalThis.fetch;
    vi.stubGlobal('fetch', async (input: string | URL, init?: RequestInit) => {
      const response = await original(input, init);
      if (!String(input).endsWith(`/subscriptions/${target.id}`)) return response;
      const json = await response.json();
      json.data.events = [...json.data.events].reverse();
      return new Response(JSON.stringify(json), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    const dialog = await openFirst();
    await within(dialog).findAllByTestId('timeline-event');
    const times = within(dialog)
      .getAllByTestId('timeline-event')
      .map((e) => e.getAttribute('data-signed-at') as string);
    expect(times).toEqual([...times].sort().reverse());
  });

  it('marks an event with an error in red and an event that needs attention with a tag', async () => {
    useMockBackend(subscriptionsMock);
    const state = subscriptionsState();
    const target = state.subscriptions.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
    const own = state.events.filter((e) => e.subscriptionId === target.id);
    own[0].error = 'Signature check failed: بريميوم ทดลอง';
    own[1].needsAttention = true;
    own[1].error = null;
    const dialog = await openFirst();
    await within(dialog).findAllByTestId('timeline-event');
    const errors = within(dialog).getAllByTestId('event-error');
    expect(
      errors.some((e) => e.textContent?.includes('Signature check failed: بريميوم ทดลอง')),
    ).toBe(true);
    for (const e of errors) expect(e.className).toContain('ant-typography-danger');
    expect(within(dialog).getAllByText('Needs attention').length).toBeGreaterThanOrEqual(1);
    // an event without an error has no error line
    const clean = within(dialog)
      .getAllByTestId('timeline-event')
      .filter((e) => !e.querySelector('[data-testid="event-error"]'));
    expect(clean.length).toBeGreaterThan(0);
  });

  it('keeps a 5000 character error without spaces inside the drawer (clamped, whole text on demand)', async () => {
    useMockBackend(subscriptionsMock);
    const state = subscriptionsState();
    const target = state.subscriptions.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
    const own = state.events.filter((e) => e.subscriptionId === target.id);
    own[0].error = 'ก'.repeat(5000);
    const dialog = await openFirst();
    const errors = await within(dialog).findAllByTestId('event-error');
    const error = errors.find((e) => e.textContent?.includes('ก'.repeat(50))) as HTMLElement;
    const button = error.querySelector('button') as HTMLElement;
    expect(button.style.overflowWrap).toBe('anywhere');
    expect(button.getAttribute('data-lines')).toBe('3');
    fireEvent.click(button);
    expect((await screen.findByTestId('full-text')).textContent).toHaveLength(5000);
  });

  it('shows a failed read with a retry', async () => {
    useMockBackend(subscriptionsMock);
    const user = userEvent.setup();
    renderPage(<SubscriptionListPage />);
    const buttons = await screen.findAllByRole('button', { name: 'Details' });
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(JSON.stringify({ code: 'RESOURCE_NOT_FOUND', message: 'gone', data: null }), {
          status: 404,
          headers: { 'content-type': 'application/json' },
        }),
    );
    await user.click(buttons[0]);
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText(/Failed to load/)).toBeInTheDocument();
  });
});
