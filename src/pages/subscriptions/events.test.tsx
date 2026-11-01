import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetStore } from '../../../mock/_core/store';
import { resetSubscriptionsStore, subscriptionsState } from '../../../mock/_core/subscriptionsData';
import * as subscriptionsMock from '../../../mock/subscriptions.mock';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { signInAs, useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import { resetUmiStub, setTestAccess } from '../../../tests/stubs/umi-max';
import access from '../../access';
import EventsPage from './events';

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
const rows = () => [...document.querySelectorAll('tbody tr.ant-table-row')] as HTMLElement[];
const rowOfEvent = (id: string) =>
  rows().find((r) => r.getAttribute('data-row-key') === id) as HTMLElement;

/** Newest first, as the list is: the id of the first event that has the property. */
const sortedEvents = () =>
  [...subscriptionsState().events].sort(
    (a, b) => b.eventSignedAt.localeCompare(a.eventSignedAt) || Number(b.id) - Number(a.id),
  );

async function pickFilter(user: ReturnType<typeof userEvent.setup>, label: string, option: string) {
  await user.click(screen.getByLabelText(label));
  await user.click(await screen.findByTitle(option));
  await user.click(screen.getByRole('button', { name: /查 询|Search/ }));
}

describe('the event list', { timeout: 30000 }, () => {
  it('shows the first page of events with type, subtype, the three times and the error, newest signed first', async () => {
    useMockBackend(subscriptionsMock);
    renderPage(<EventsPage />);
    await waitFor(() => expect(rows()).toHaveLength(20));
    const expected = sortedEvents()
      .slice(0, 20)
      .map((e) => e.id);
    expect(rows().map((r) => r.getAttribute('data-row-key'))).toEqual(expected);
    expect(document.body.textContent).not.toMatch(/null|undefined/);
  });

  it('marks an event with an error in red and an event that needs attention with a tag', async () => {
    useMockBackend(subscriptionsMock);
    renderPage(<EventsPage />);
    await waitFor(() => expect(rows()).toHaveLength(20));
    const failed = rows().filter((r) => r.querySelector('.ant-typography-danger'));
    expect(failed.length).toBeGreaterThan(0);
    const attention = sortedEvents()
      .slice(0, 20)
      .filter((e) => e.needsAttention).length;
    expect(attention).toBeGreaterThan(0);
    const tags = [...document.querySelectorAll('tbody .ant-tag')].filter(
      (t) => t.textContent === 'Needs attention',
    );
    expect(tags).toHaveLength(attention);
  });

  it('keeps an error of 5000 characters without spaces, and text of every language, inside its cell', async () => {
    const events = sortedEvents();
    events[0].error = 'ก'.repeat(5000);
    events[1].error = 'خطأ في المعالجة '.repeat(40);
    events[2].error = 'Lỗi xử lý 😀'.repeat(30);
    useMockBackend(subscriptionsMock);
    renderPage(<EventsPage />);
    await waitFor(() => expect(rows()).toHaveLength(20));
    const clamps = [...document.querySelectorAll('tbody button[data-lines]')] as HTMLElement[];
    expect(clamps.length).toBeGreaterThanOrEqual(3);
    for (const c of clamps) {
      expect(c.style.overflowWrap).toBe('anywhere');
      expect(c.style.maxWidth).not.toBe('');
    }
  });

  it('asks the server for FAILED events only when the status filter is set, and shows only events with an error', async () => {
    const calls = useMockBackend(subscriptionsMock);
    const user = userEvent.setup();
    renderPage(<EventsPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    await pickFilter(user, 'Status', 'Failed');
    await waitFor(() => expect(calls.some((c) => c.url.includes('status=FAILED'))).toBe(true));
    const failed = subscriptionsState().events.filter((e) => e.error !== null).length;
    await waitFor(() => expect(rows()).toHaveLength(Math.min(20, failed)));
    for (const r of rows()) expect(r.querySelector('.ant-typography-danger')).not.toBeNull();
  });

  it('asks for needsAttention=true when "Needs attention" is picked', async () => {
    const calls = useMockBackend(subscriptionsMock);
    const user = userEvent.setup();
    renderPage(<EventsPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    await pickFilter(user, 'Needs attention', 'Yes');
    await waitFor(() =>
      expect(calls.some((c) => c.url.includes('needsAttention=true'))).toBe(true),
    );
    const count = subscriptionsState().events.filter((e) => e.needsAttention).length;
    await waitFor(() => expect(rows()).toHaveLength(Math.min(20, count)));
  });

  it('shows the server error with a retry instead of breaking', async () => {
    stubFetch(async () => jsonResponse(503, envelope('DEPENDENCY_UNAVAILABLE')));
    renderPage(<EventsPage />);
    expect(await screen.findByText(/Failed to load/)).toBeInTheDocument();
  });
});

describe('the Reprocess and Mark handled buttons', { timeout: 30000 }, () => {
  it('shows neither to an administrator with only SUBSCRIPTION:VIEW', async () => {
    as(['SUBSCRIPTION:VIEW']);
    useMockBackend(subscriptionsMock);
    renderPage(<EventsPage />);
    await waitFor(() => expect(rows()).toHaveLength(20));
    expect(screen.queryByRole('button', { name: 'Reprocess' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mark handled' })).toBeNull();
  });

  it('shows neither to an administrator with only SUBSCRIPTION:CONFIG and VIEW (they need GRANT)', async () => {
    as(['SUBSCRIPTION:VIEW', 'SUBSCRIPTION:CONFIG']);
    useMockBackend(subscriptionsMock);
    renderPage(<EventsPage />);
    await waitFor(() => expect(rows()).toHaveLength(20));
    expect(screen.queryByRole('button', { name: 'Reprocess' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mark handled' })).toBeNull();
  });

  it('shows Reprocess on the events with an error and Mark handled on the ones that need attention, to SUBSCRIPTION:GRANT', async () => {
    as(['SUBSCRIPTION:VIEW', 'SUBSCRIPTION:GRANT']);
    useMockBackend(subscriptionsMock);
    renderPage(<EventsPage />);
    await waitFor(() => expect(rows()).toHaveLength(20));
    for (const event of sortedEvents().slice(0, 20)) {
      const row = rowOfEvent(event.id);
      expect(
        !!within(row).queryByRole('button', { name: 'Reprocess' }),
        `reprocess ${event.id}`,
      ).toBe(event.error !== null);
      expect(!!within(row).queryByRole('button', { name: 'Mark handled' }), `ack ${event.id}`).toBe(
        event.needsAttention,
      );
    }
    expect(screen.getAllByRole('button', { name: 'Reprocess' }).length).toBeGreaterThan(0);
  });

  it('reprocesses after an inline question, once, and the row loses its error', async () => {
    const calls = useMockBackend(subscriptionsMock);
    const user = userEvent.setup();
    renderPage(<EventsPage />);
    await waitFor(() => expect(rows()).toHaveLength(20));
    const failed = sortedEvents()
      .slice(0, 20)
      .find((e) => e.error !== null) as { id: string };
    await user.click(within(rowOfEvent(failed.id)).getByRole('button', { name: 'Reprocess' }));
    expect(writes(calls)).toHaveLength(0);
    expect(await screen.findByText('Process this event again?')).toBeInTheDocument();
    const ok = screen.getByRole('button', { name: /OK|确 定|确定/ });
    fireEvent.click(ok);
    fireEvent.click(ok);
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    await new Promise((r) => setTimeout(r, 100));
    expect(writes(calls)).toHaveLength(1);
    expect(writes(calls)[0]).toMatchObject({
      method: 'POST',
      url: `/api/admin/subscription-events/${failed.id}/reprocess`,
    });
    await waitFor(() =>
      expect(subscriptionsState().events.find((e) => e.id === failed.id)?.error).toBeNull(),
    );
    await waitFor(() =>
      expect(within(rowOfEvent(failed.id)).queryByRole('button', { name: 'Reprocess' })).toBeNull(),
    );
  });

  it('does not ask the server when the question is answered with Cancel', async () => {
    const calls = useMockBackend(subscriptionsMock);
    const user = userEvent.setup();
    renderPage(<EventsPage />);
    await waitFor(() => expect(rows()).toHaveLength(20));
    const failed = sortedEvents()
      .slice(0, 20)
      .find((e) => e.error !== null) as { id: string };
    await user.click(within(rowOfEvent(failed.id)).getByRole('button', { name: 'Reprocess' }));
    await user.click(await screen.findByRole('button', { name: /Cancel|取 消|取消/ }));
    expect(writes(calls)).toHaveLength(0);
  });

  it('marks an event handled with one request, and the tag goes away', async () => {
    const calls = useMockBackend(subscriptionsMock);
    renderPage(<EventsPage />);
    await waitFor(() => expect(rows()).toHaveLength(20));
    const target = sortedEvents()
      .slice(0, 20)
      .find((e) => e.needsAttention) as { id: string };
    const button = within(rowOfEvent(target.id)).getByRole('button', { name: 'Mark handled' });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    await new Promise((r) => setTimeout(r, 100));
    expect(writes(calls)).toHaveLength(1);
    expect(writes(calls)[0]).toMatchObject({
      method: 'POST',
      url: `/api/admin/subscription-events/${target.id}/ack`,
    });
    await waitFor(() =>
      expect(subscriptionsState().events.find((e) => e.id === target.id)?.needsAttention).toBe(
        false,
      ),
    );
    await waitFor(() =>
      expect(
        within(rowOfEvent(target.id)).queryByRole('button', { name: 'Mark handled' }),
      ).toBeNull(),
    );
  });

  it('says why when the backend refuses (409 INVALID_STATE: someone else handled it)', async () => {
    const calls = useMockBackend(subscriptionsMock);
    renderPage(<EventsPage />);
    await waitFor(() => expect(rows()).toHaveLength(20));
    const target = sortedEvents()
      .slice(0, 20)
      .find((e) => e.needsAttention) as { id: string };
    // the event is handled by someone else after the list was read
    (
      subscriptionsState().events.find((e) => e.id === target.id) as { needsAttention: boolean }
    ).needsAttention = false;
    fireEvent.click(within(rowOfEvent(target.id)).getByRole('button', { name: 'Mark handled' }));
    expect(
      await screen.findByText('The current state of the item does not allow this action.'),
    ).toBeInTheDocument();
    expect(writes(calls)).toHaveLength(1);
  });

  it('does not send again when the token ended during the write', async () => {
    const events = [
      {
        id: '1',
        subscriptionId: '500',
        accountId: '10000000001',
        store: 'APPLE',
        sourceEventId: 'e1',
        type: 'DID_RENEW',
        subtype: null,
        eventSignedAt: '2026-10-01T00:00:00Z',
        receivedAt: '2026-10-01T00:00:01Z',
        processedAt: null,
        error: 'boom',
        needsAttention: true,
      },
    ];
    const calls = stubFetch(async ({ init }) =>
      (init.method ?? 'GET') === 'GET'
        ? jsonResponse(200, envelope('200', { items: events, total: 1 }))
        : jsonResponse(401, envelope('ADMIN_INVALID_TOKEN')),
    );
    renderPage(<EventsPage />);
    await waitFor(() => expect(rows()).toHaveLength(1));
    fireEvent.click(within(rows()[0]).getByRole('button', { name: 'Mark handled' }));
    await waitFor(() => expect(calls.filter((c) => c.init.method === 'POST')).toHaveLength(1));
    await new Promise((r) => setTimeout(r, 100));
    expect(calls.filter((c) => c.init.method === 'POST')).toHaveLength(1);
  });
});
