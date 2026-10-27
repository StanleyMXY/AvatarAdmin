import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { inviteData } from '../../../mock/_core/inviteData';
import * as inviteMock from '../../../mock/invite.mock';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import { withTimeZone } from '../../../tests/withTimeZone';
import enUS from '../../locales/en-US';
import CodesPage from './codes';
import { signIn } from './testSetup';

beforeEach(() => signIn('root'));
afterEach(() => vi.unstubAllGlobals());

const page = (items: unknown[], total = items.length) =>
  jsonResponse(200, envelope('200', { items, total }));

describe('the invite code page', { timeout: 30000 }, () => {
  it('lists the codes with the owner account and the time the owner account was created, 20 a page', async () => {
    const calls = useMockBackend(inviteMock);
    renderPage(<CodesPage />);
    const newest = [...inviteData().accounts].sort(
      (a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id),
    )[0];
    await screen.findByText(newest.code);
    for (const head of ['Invite code', 'Owner account ID', 'Owner account created']) {
      expect(screen.getAllByText(head).length, head).toBeGreaterThan(0);
    }
    const row = screen.getByText(newest.code).closest('tr') as HTMLElement;
    expect(within(row).getByText(newest.id)).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(21);
    expect(calls.find((c) => c.url.includes('/invites/codes'))?.url).toBe(
      '/api/admin/invites/codes?page=1&pageSize=20',
    );
  });

  it('asks for the next page when the page is turned', async () => {
    const calls = useMockBackend(inviteMock);
    const user = userEvent.setup();
    renderPage(<CodesPage />);
    await user.click(await screen.findByTitle('2'));
    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/admin/invites/codes?page=2&pageSize=20')).toBe(true),
    );
  });

  it('shows the creation time in the time zone of the browser', async () => {
    await withTimeZone('Asia/Singapore', async () => {
      stubFetch(async () =>
        page([
          { id: '1', code: 'K7M2Q9XD', ownerAccountId: 'a1', createdAt: '2026-10-01T00:00:00Z' },
        ]),
      );
      renderPage(<CodesPage />);
      expect(await screen.findByText('10/01/2026, 08:00:00')).toBeInTheDocument();
    });
  });

  it('survives a 5000 character owner id, a code that is not text and an empty creation time', async () => {
    const long = 'A'.repeat(5000);
    stubFetch(async () =>
      page([
        { id: '1', code: 'K7M2Q9XD', ownerAccountId: long, createdAt: '2026-10-01T00:00:00Z' },
        { id: '2', code: 12345, ownerAccountId: null, createdAt: null },
        {
          id: '3',
          code: { weird: true },
          ownerAccountId: 'ก็'.repeat(300),
          createdAt: 'not a time',
        },
      ]),
    );
    renderPage(<CodesPage />);
    expect(await screen.findByText('K7M2Q9XD')).toBeInTheDocument();
    expect(screen.getByText('12345')).toBeInTheDocument();
    const clipped = document.querySelectorAll('button[data-lines]');
    expect(clipped.length).toBeGreaterThanOrEqual(2);
    expect(document.body.textContent).not.toMatch(/undefined|NaN|\[object/);
  });

  it('shows only the translated words of a known error code, never the words of the backend', async () => {
    stubFetch(async () =>
      jsonResponse(403, envelope('ADMIN_FORBIDDEN', null, 'raw backend words about codes')),
    );
    renderPage(<CodesPage />);
    expect(await screen.findByText(new RegExp(enUS['error.ADMIN_FORBIDDEN']))).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('raw backend words');
  });
});
