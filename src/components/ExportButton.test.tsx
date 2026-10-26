import { fireEvent, screen, waitFor } from '@testing-library/react';
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
    [400, 'INVALID_REQUEST', 'Some input is not valid. Please check the fields and try again.'],
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
