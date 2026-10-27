import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { avatarState, GENERATION_MS } from '../../../mock/_core/avatarData';
import avatarMock from '../../../mock/avatar.mock';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import DefaultAvatarsPage from './defaultAvatars';
import { signIn, stubObjectUrls } from './testSetup';

const backend = () => useMockBackend({ default: avatarMock });

// The clock moves by itself as well as by hand, so the table's own waits still finish.
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  signIn('root');
  stubObjectUrls();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const LUNA = 'Luna 😀'; // da-2: GENERATING and never finishes by itself
const ARABIC = 'مرحبا بك في التطبيق'; // da-3: DRAFT

const rowOf = async (name: string) => (await screen.findByText(name)).closest('tr') as HTMLElement;
const listReads = (calls: { method: string; url: string }[]) =>
  calls.filter((c) => c.method === 'GET' && c.url.startsWith('/api/admin/default-avatars')).length;
const pass = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
/** Makes the seeded generating avatar one that has finished: the next read of the list shows it ready. */
const finishLuna = () => {
  const luna = avatarState.defaultAvatars.find((d) => d.id === 'da-2');
  if (luna) luna.startedAt = Date.now() - GENERATION_MS - 10;
};

describe('the default avatar page: reading again while an avatar is generating', {
  timeout: 30000,
}, () => {
  it('reads the list again every 5 seconds while a row is generating', async () => {
    const calls = backend();
    renderPage(<DefaultAvatarsPage />);
    await rowOf(LUNA);
    const first = listReads(calls);
    expect(first).toBe(1);
    await pass(4000);
    expect(listReads(calls)).toBe(first);
    await pass(1500);
    expect(listReads(calls)).toBe(first + 1);
    await pass(5000);
    expect(listReads(calls)).toBe(first + 2);
  });

  it('shows the row as ready by itself once the generation has finished, and stops reading', async () => {
    const calls = backend();
    renderPage(<DefaultAvatarsPage />);
    expect(within(await rowOf(LUNA)).getByText('Generating')).toBeInTheDocument();
    finishLuna();
    await pass(5500);
    await waitFor(async () =>
      expect(within(await rowOf(LUNA)).getByText('Ready')).toBeInTheDocument(),
    );
    const settled = listReads(calls);
    await pass(30000);
    expect(listReads(calls)).toBe(settled);
  });

  it('stops on a draft that comes back with a reason too: that is an end state', async () => {
    const calls = backend();
    const luna = avatarState.defaultAvatars.find((d) => d.id === 'da-2');
    if (luna) luna.name = 'fail Luna';
    renderPage(<DefaultAvatarsPage />);
    expect(within(await rowOf('fail Luna')).getByText('Generating')).toBeInTheDocument();
    finishLuna();
    await pass(5500);
    await waitFor(async () =>
      expect(within(await rowOf('fail Luna')).getByTestId('failure-reason')).toBeInTheDocument(),
    );
    const settled = listReads(calls);
    await pass(30000);
    expect(listReads(calls)).toBe(settled);
  });

  it('reads nothing by itself when no row is generating', async () => {
    const calls = backend();
    const luna = avatarState.defaultAvatars.find((d) => d.id === 'da-2');
    if (luna) {
      luna.status = 'READY';
      luna.startedAt = null;
    }
    renderPage(<DefaultAvatarsPage />);
    await rowOf(LUNA);
    expect(listReads(calls)).toBe(1);
    await pass(30000);
    expect(listReads(calls)).toBe(1);
  });

  it('stops when the page is left', async () => {
    const calls = backend();
    const view = renderPage(<DefaultAvatarsPage />);
    await rowOf(LUNA);
    await pass(5500);
    const before = listReads(calls);
    expect(before).toBeGreaterThan(1);
    view.unmount();
    // neither the 5 second timer nor the 5 minute one is left running
    await pass(100);
    expect(vi.getTimerCount()).toBe(0);
    await pass(30000);
    expect(listReads(calls)).toBe(before);
  });

  it('stops after 5 minutes, says so, and Refresh starts the 5 minutes again', async () => {
    const calls = backend();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage(<DefaultAvatarsPage />);
    await rowOf(LUNA);
    await pass(5 * 60 * 1000 + 1000);
    const stopped = listReads(calls);
    // one read at the start, one every 5 seconds for 5 minutes
    expect(stopped).toBeGreaterThanOrEqual(60);
    expect(stopped).toBeLessThanOrEqual(62);
    expect(
      screen.getByText('Automatic refresh stopped after 5 minutes. Press Refresh to check again.'),
    ).toBeInTheDocument();
    await pass(60000);
    expect(listReads(calls)).toBe(stopped);

    await user.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(listReads(calls)).toBe(stopped + 1));
    expect(
      screen.queryByText(
        'Automatic refresh stopped after 5 minutes. Press Refresh to check again.',
      ),
    ).not.toBeInTheDocument();
    await pass(5500);
    expect(listReads(calls)).toBe(stopped + 2);
  });

  it('starts when Generate makes a row generating, and shows it ready without a press on Refresh', async () => {
    const calls = backend();
    const luna = avatarState.defaultAvatars.find((d) => d.id === 'da-2');
    if (luna) {
      luna.status = 'READY';
      luna.startedAt = null;
    }
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage(<DefaultAvatarsPage />);
    const row = await rowOf(ARABIC);
    await user.click(within(row).getByRole('button', { name: 'Generate' }));
    await waitFor(async () =>
      expect(within(await rowOf(ARABIC)).getByText('Generating')).toBeInTheDocument(),
    );
    const afterGenerate = listReads(calls);
    await pass(5500);
    expect(listReads(calls)).toBeGreaterThan(afterGenerate);
    await waitFor(async () =>
      expect(within(await rowOf(ARABIC)).getByText('Ready')).toBeInTheDocument(),
    );
  });
});
