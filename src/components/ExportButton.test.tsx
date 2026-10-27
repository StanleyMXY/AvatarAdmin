import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { envelope, jsonResponse, stubFetch, XLSX_TYPE } from '../../tests/httpStubs';
import { renderPage } from '../../tests/renderPage';
import { resetUmiStub, setTestAccess } from '../../tests/stubs/umi-max';
import access from '../access';
import { resetSessionState, setToken } from '../request/session';
import { ExportButton } from './ExportButton';

let saved: string[];
beforeEach(() => {
  resetUmiStub();
  resetSessionState();
  sessionStorage.clear();
  setToken('tok');
  saved = [];
  (URL as unknown as { createObjectURL: unknown }).createObjectURL = vi.fn(() => 'blob:x');
  (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    saved.push(this.download);
  });
  vi.spyOn(window, 'open').mockImplementation(() => null);
  as(['STATS:EXPORT', 'STATS:VIEW']);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const as = (permissions: string[], superAdmin = false) =>
  setTestAccess(access({ me: { superAdmin, permissions } }) as unknown as Record<string, unknown>);

const sheet = () =>
  new Response(Uint8Array.from([80, 75, 3, 4, 1, 2, 3]), {
    status: 200,
    headers: {
      'content-type': XLSX_TYPE,
      'content-disposition': 'attachment; filename="daily-2026-10-21.xlsx"',
    },
  });

const mount = (props: Partial<React.ComponentProps<typeof ExportButton>> = {}) =>
  renderPage(
    <ExportButton
      name="daily"
      params={{ from: '2026-10-01', to: '2026-10-21' }}
      viewCode="STATS:VIEW"
      {...props}
    />,
  );

describe('ExportButton', () => {
  it('is not drawn without STATS:EXPORT, nor without the permission of the page', () => {
    as(['STATS:VIEW']);
    const { unmount } = mount();
    expect(screen.queryByRole('button')).toBeNull();
    unmount();
    as(['STATS:EXPORT']);
    mount();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('is drawn for a super administrator and for someone with both codes', () => {
    as([], true);
    const { unmount } = mount();
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
    unmount();
    as(['STATS:EXPORT', 'STATS:VIEW']);
    mount();
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
  });

  it('can ask for other codes instead', () => {
    as(['USER:EXPORT']);
    mount({ requiredCodes: ['USER:EXPORT'], url: '/users/export' });
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
  });

  it('asks with the token in a header and the parameters in the query, saves the file, never opens a window', async () => {
    const calls = stubFetch(() => sheet());
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    await waitFor(() => expect(saved).toEqual(['daily-2026-10-21.xlsx']));
    expect(calls[0].url).toBe('/api/admin/stats/export/daily?from=2026-10-01&to=2026-10-21');
    expect(calls[0].init.headers.Authorization).toBe('Bearer tok');
    expect(window.open).not.toHaveBeenCalled();
    expect(await screen.findByText(/Saved daily-2026-10-21\.xlsx/)).toBeInTheDocument();
  });

  it('uses another address when given', async () => {
    const calls = stubFetch(() => sheet());
    mount({ url: '/users/export' });
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(calls[0].url.startsWith('/api/admin/users/export?')).toBe(true);
  });

  it.each([
    [429, 'RATE_LIMITED', 'Too many requests. Please try again later.'],
    [403, 'ADMIN_FORBIDDEN', 'You do not have permission to do this.'],
    [
      400,
      'INVALID_REQUEST',
      'Some input is not valid. Please check the fields and try again. If the range is large, narrow the date range or the filters (an export has a row limit).',
    ],
  ])('shows the backend refusal %s %s and saves nothing', async (status, code, text) => {
    stubFetch(() => jsonResponse(status, envelope(code)));
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(saved).toEqual([]);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole('button', { name: /Export/ })).not.toBeDisabled());
  });

  it('does not save a JSON error that came with a success status', async () => {
    stubFetch(() => jsonResponse(200, envelope('200', { nothing: true })));
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Export/ })).not.toBeDisabled());
    expect(saved).toEqual([]);
  });

  it('asks once however often it is pressed', async () => {
    let release: (r: Response) => void = () => {};
    const calls = stubFetch(
      () =>
        new Promise<Response>((r) => {
          release = r;
        }),
    );
    mount();
    const button = screen.getByRole('button', { name: /Export/ });
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);
    expect(calls).toHaveLength(1);
    release(sheet());
    await waitFor(() => expect(saved).toHaveLength(1));
  });

  it('writes the report name into the address safely', async () => {
    const calls = stubFetch(() => sheet());
    mount({ name: 'a b/c' });
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].url.startsWith('/api/admin/stats/export/a%20b%2Fc?')).toBe(true);
  });

  it('is disabled while the file is being fetched', async () => {
    let release: (r: Response) => void = () => {};
    stubFetch(
      () =>
        new Promise<Response>((r) => {
          release = r;
        }),
    );
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Export/ })).toBeDisabled());
    release(sheet());
    await waitFor(() => expect(saved).toHaveLength(1));
  });

  it('refuses a lost session with its own text and saves nothing', async () => {
    stubFetch(() => jsonResponse(401, envelope('ADMIN_INVALID_TOKEN')));
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(
      await screen.findByText('Your session has expired. Please sign in again.'),
    ).toBeInTheDocument();
    expect(saved).toEqual([]);
  });

  it('shows the texts in Chinese too', async () => {
    stubFetch(() => jsonResponse(429, envelope('RATE_LIMITED')));
    renderPage(<ExportButton name="daily" params={{}} viewCode="STATS:VIEW" />, 'zh-CN');
    fireEvent.click(screen.getByRole('button', { name: /导\s*出/ }));
    expect(await screen.findByText('请求过于频繁，请稍后再试')).toBeInTheDocument();
  });
});

/** A fetch that never answers and rejects like the browser when its signal is aborted. */
function hangingFetch() {
  const signals: AbortSignal[] = [];
  const calls = stubFetch(
    ({ init }) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init.signal as AbortSignal;
        signals.push(signal);
        signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      }),
  );
  return { calls, signals };
}

describe('ExportButton: cancel and time limit', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('offers no cancel button until the download starts', () => {
    mount();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
  });

  it('cancels the download: the request is aborted, nothing is saved, and it can be started again', async () => {
    const { signals } = hangingFetch();
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(signals[0].aborted).toBe(true);
    expect(await screen.findByText('Export cancelled')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
    await waitFor(() => expect(screen.getByRole('button', { name: /Export/ })).not.toBeDisabled());
    expect(saved).toEqual([]);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(screen.queryByText(/Network error/)).toBeNull();
  });

  it('writes the cancel button and the note in Chinese too', async () => {
    hangingFetch();
    renderPage(<ExportButton name="daily" params={{}} viewCode="STATS:VIEW" />, 'zh-CN');
    fireEvent.click(screen.getByRole('button', { name: /导\s*出/ }));
    fireEvent.click(await screen.findByRole('button', { name: /取\s*消/ }));
    expect(await screen.findByText('已取消导出')).toBeInTheDocument();
  });

  it('stops the download when the page is left, and says nothing', async () => {
    const { signals } = hangingFetch();
    const { unmount } = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    await waitFor(() => expect(signals).toHaveLength(1));
    unmount();
    expect(signals[0].aborted).toBe(true);
    expect(saved).toEqual([]);
  });

  it('shows "Request timed out. Please try again." after 5 minutes and saves nothing', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    hangingFetch();
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(299_999);
    });
    expect(screen.queryByText('Request timed out. Please try again.')).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(screen.getByText('Request timed out. Please try again.')).toBeInTheDocument();
    expect(saved).toEqual([]);
  });

  it('shows the gateway text when the gateway page comes back', async () => {
    stubFetch(() => new Response('<html>Bad Gateway</html>', { status: 502 }));
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(
      await screen.findByText('The service is temporarily unavailable. Please try again later.'),
    ).toBeInTheDocument();
    expect(saved).toEqual([]);
  });
});
