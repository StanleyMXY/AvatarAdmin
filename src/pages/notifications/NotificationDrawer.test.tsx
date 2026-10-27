import { fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { renderPage } from '../../../tests/renderPage';
import { NotificationDrawer } from './NotificationDrawer';
import { signIn } from './testSetup';

vi.setConfig({ testTimeout: 30000 });

beforeEach(() => signIn('root'));
afterEach(() => vi.unstubAllGlobals());

const detail = (id: string, title: string) => ({
  id,
  accountId: 'acc-1',
  category: 'ADMIN',
  titleI18n: { en: title },
  bodyI18n: { en: `body of ${id}` },
  templateKey: null,
  templateParams: null,
  linkType: 'NONE',
  linkTarget: null,
  isRead: false,
  sentBy: '1001',
  sentByUsername: 'root',
  createdAt: '2026-10-20T08:30:00.000Z',
});

/** The drawer for one id, with a button that asks it for another: the drawer stays mounted, only its id changes. */
function Harness() {
  const [id, setId] = useState('one');
  return (
    <>
      <button type="button" onClick={() => setId('two')}>
        next
      </button>
      <NotificationDrawer id={id} onClose={() => {}} />
    </>
  );
}

describe('the detail drawer when it is asked for another notification while the first is still on its way', () => {
  it('shows the second notification, and the late answer of the first does not replace it', async () => {
    let releaseFirst: () => void = () => {};
    stubFetch(async ({ url }) => {
      if (url.endsWith('/one')) {
        await new Promise<void>((resolve) => {
          releaseFirst = resolve;
        });
        return jsonResponse(200, envelope('200', detail('one', 'Late first')));
      }
      return jsonResponse(200, envelope('200', detail('two', 'Quick second')));
    });
    renderPage(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'next' }));
    await screen.findByText('Quick second');
    releaseFirst();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByText('Late first')).toBeNull();
    expect(screen.getByText('Quick second')).toBeInTheDocument();
  });

  it('shows the failure of the current notification, not that of an earlier one', async () => {
    let releaseFirst: () => void = () => {};
    stubFetch(async ({ url }) => {
      if (url.endsWith('/one')) {
        await new Promise<void>((resolve) => {
          releaseFirst = resolve;
        });
        return jsonResponse(500, envelope('INTERNAL_ERROR'));
      }
      return jsonResponse(200, envelope('200', detail('two', 'Quick second')));
    });
    renderPage(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'next' }));
    await screen.findByText('Quick second');
    releaseFirst();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByText(/Failed to load/)).toBeNull();
  });
});
