// Shared by the two statistics page tests: a backend for the report, landing and export addresses of
// the check-in and task statistics, and the permissions of the signed-in administrator.
import { within } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { envelope, jsonResponse, stubFetch, XLSX_TYPE } from '../../../tests/httpStubs';
import { resetUmiStub, setTestAccess, setTestInitialState } from '../../../tests/stubs/umi-max';
import access from '../../access';
import { resetSessionState, setToken } from '../../request/session';

/** The moment of every statistics test: 26 October 2026, 20:00 UTC (so "the last 7 days" is 20 to 26 October). */
export const NOW = '2026-10-26T20:00:00Z';

export function startStatsTest(permissions: string[], meta: Record<string, unknown> = {}) {
  resetUmiStub();
  resetSessionState();
  sessionStorage.clear();
  localStorage.clear();
  setToken('tok');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW));
  as(permissions, false, meta);
  (URL as unknown as { createObjectURL: unknown }).createObjectURL = vi.fn(() => 'blob:x');
  (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
}

export function stopStatsTest() {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
}

export function as(permissions: string[], superAdmin = false, meta: Record<string, unknown> = {}) {
  const me = { id: '1', username: 'tester', superAdmin, mustChangePassword: false, permissions };
  setTestAccess(access({ me }) as unknown as Record<string, unknown>);
  setTestInitialState({ me, meta });
}

export const sheet = (name = 'report.xlsx') =>
  new Response(Uint8Array.from([80, 75, 3, 4]), {
    status: 200,
    headers: {
      'content-type': XLSX_TYPE,
      'content-disposition': `attachment; filename="${name}"`,
    },
  });

export type Reply = (query: URLSearchParams) => Response | Promise<Response> | undefined;

/**
 * Answers the report addresses with `reports[path]` (a function of the query that returns the rows),
 * every landing with an empty 200 and every export with a spreadsheet; `override` goes first and can
 * answer anything itself (return `undefined` to let the usual answer happen).
 */
export function serve(
  reports: Record<string, (query: URLSearchParams) => unknown[]>,
  override?: (call: {
    url: string;
    method: string;
    query: URLSearchParams;
  }) => Response | undefined | Promise<Response | undefined>,
) {
  return stubFetch(async (call) => {
    const url = new URL(call.url, 'http://localhost');
    const method = (call.init.method ?? 'GET').toUpperCase();
    const first = await override?.({ url: call.url, method, query: url.searchParams });
    if (first) return first;
    if (url.pathname.startsWith('/api/admin/stats/land/'))
      return jsonResponse(200, envelope('200', null));
    if (url.pathname.startsWith('/api/admin/stats/export/')) return sheet();
    const rows = reports[url.pathname.replace('/api/admin/stats/', '')];
    if (rows) return jsonResponse(200, envelope('200', { items: rows(url.searchParams) }));
    return jsonResponse(404, envelope('RESOURCE_NOT_FOUND'));
  });
}

export const callsTo = (calls: { url: string }[], path: string) =>
  calls.filter((c) => c.url.startsWith(`/api/admin/stats/${path}`));

export const chartData = (kind: string, scope: HTMLElement = document.body) =>
  JSON.parse(within(scope).getByTestId(`chart-${kind}`).textContent ?? '[]') as Record<
    string,
    unknown
  >[];

export const bodyRows = (scope: HTMLElement = document.body) => [
  ...scope.querySelectorAll('.ant-table-tbody tr.ant-table-row'),
];

/** The text of every cell of the table rows in `scope`. */
export const cellTexts = (scope: HTMLElement = document.body) =>
  bodyRows(scope).map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent ?? ''));

export const rangeInputs = () => [
  ...document.querySelectorAll<HTMLInputElement>('.ant-picker-range input'),
];

/** Types a first and a last day into the range picker (the range is taken when both are set). */
export async function setRange(user: ReturnType<typeof userEvent.setup>, from: string, to: string) {
  const [start, end] = rangeInputs();
  await user.clear(start);
  await user.type(start, `${from}{Enter}`);
  await user.clear(end);
  await user.type(end, `${to}{Enter}`);
}
