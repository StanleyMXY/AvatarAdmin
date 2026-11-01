// Helpers that the page tests of several modules used to carry a copy of each in their own
// `testSetup.ts`. A module's `testSetup.ts` re-exports the ones its tests use.
import { within as scoped, screen, waitFor } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';
import { expect, vi } from 'vitest';
import { apiRequest } from '../src/request/apiClient';
import { XLSX_TYPE } from './httpStubs';

/** Opens an Ant Design select by its label and clicks the option with this text. */
export async function chooseOption(
  user: ReturnType<typeof userEvent.setup>,
  label: string | RegExp,
  optionText: string | RegExp,
  within: HTMLElement | Document = document,
) {
  const box = within === document ? screen : scoped(within as HTMLElement);
  await user.click(box.getByRole('combobox', { name: label }));
  const options = await screen.findAllByText(optionText, {
    selector: '.ant-select-item-option-content',
  });
  await user.click(options[options.length - 1]);
}

/** Opens the search area of a list if it is closed (the toggle says Expand or its Chinese). */
export async function expandSearch(user: ReturnType<typeof userEvent.setup>) {
  const toggle = await screen.findByText(/展开|Expand/);
  await user.click(toggle);
}

/**
 * Resolves once every dialog has started to close or is gone. happy-dom never fires the animation
 * events that remove a closed Ant Design dialog, so a dialog that is closing keeps its role for good.
 */
export const dialogsClosed = () =>
  waitFor(() => {
    for (const dialog of document.querySelectorAll('.ant-modal')) {
      expect(dialog.className, 'a dialog is still open').toMatch(/-leave|-hidden/);
    }
  });

/** The calls that changed something. */
export const writesOf = <T extends { method: string }>(calls: T[]) =>
  calls.filter((c) => c.method !== 'GET');

/** The calls that changed something, except the uploads of files (they are made before the save). */
export const writesExceptUploads = <T extends { method: string; url: string }>(calls: T[]) =>
  writesOf(calls).filter((c) => !c.url.startsWith('/api/admin/uploads/'));

/**
 * Makes every write of the page (or those `only` picks) wait until `release()`, so that a second
 * press can come while the first request is still on its way. Call it after `useMockBackend`.
 * `started()` counts the writes that have been handed to the network so far.
 */
export function holdWrites(only: (init: RequestInit) => boolean = () => true) {
  const real = globalThis.fetch;
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL, init: RequestInit = {}) => {
      if ((init.method ?? 'GET').toUpperCase() !== 'GET' && only(init)) {
        started += 1;
        await gate;
      }
      return real(input, init);
    }),
  );
  return { release, started: () => started };
}

type Override = (call: {
  url: URL;
  method: string;
  init: RequestInit;
}) => Response | undefined | Promise<Response | undefined>;

/**
 * Lets a test answer some requests itself while the mock backend answers the rest. Call it after
 * `useMockBackend`; `answer` returns a `Response` for the requests it takes and `undefined` for the
 * others.
 */
export function overrideFetch(answer: Override): { url: string; method: string; body: unknown }[] {
  const real = globalThis.fetch;
  const taken: { url: string; method: string; body: unknown }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL, init: RequestInit = {}) => {
      const url = new URL(String(input), 'http://localhost');
      const method = (init.method ?? 'GET').toUpperCase();
      const response = await answer({ url, method, init });
      if (response === undefined) return real(input, init);
      taken.push({
        url: `${url.pathname}${url.search}`,
        method,
        body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
      });
      return response;
    }),
  );
  return taken;
}

/** A JSON answer in the envelope of the backend. */
export const jsonAnswer = (status: number, code: string, data: unknown = null, message = '') =>
  new Response(
    JSON.stringify({
      code,
      message: message || (code === '200' ? 'success' : `message of ${code}`),
      data,
    }),
    { status, headers: { 'content-type': 'application/json' } },
  );

/** The answer of an export: the first bytes of a spreadsheet, saved as `<name>.xlsx`. */
export const sheetAnswer = (name: string) =>
  new Response(Uint8Array.from([80, 75, 3, 4]), {
    status: 200,
    headers: {
      'content-type': XLSX_TYPE,
      'content-disposition': `attachment; filename="${name}.xlsx"`,
    },
  });

/** The uploads that the page made (empty it when the module's data is put back). */
export const uploads: { url: string; name: string; size: number }[] = [];

/**
 * What `vi.mock('../../request/upload', ...)` returns: the upload goes to the mock backend, which
 * answers with the record it made (the real upload uses XMLHttpRequest, which a test does not have).
 */
export const uploadModule = {
  uploadFile: async (options: { url: string; file: File }) => {
    uploads.push({ url: options.url, name: options.file.name, size: options.file.size });
    return apiRequest({ method: 'POST', url: options.url });
  },
};

/**
 * Puts a spreadsheet answer in front of whatever `fetch` is now: a statistics export address gets
 * the file and is written to the list, every other address goes on to the old `fetch`. Also stands
 * in for the browser calls that save a file.
 */
export function withExportSheet(): { url: string }[] {
  const exports: { url: string }[] = [];
  const delegate = globalThis.fetch;
  (URL as unknown as { createObjectURL: unknown }).createObjectURL = vi.fn(() => 'blob:x');
  (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith('/api/admin/stats/export/')) {
        exports.push({ url });
        return sheetAnswer('export');
      }
      return delegate(input, init);
    }),
  );
  return exports;
}

/** Stands in for the browser calls that make an address for a picture that was chosen. */
export function stubObjectUrls(): void {
  (URL as unknown as { createObjectURL: unknown }).createObjectURL = vi.fn(() => 'blob:preview');
  (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = vi.fn();
}

/**
 * Lets the page and the pending promises run: a test that holds a request and presses a button twice
 * waits for this before it counts the requests, so that a second request that is merely late is
 * still counted.
 */
export const settled = () => new Promise<void>((resolve) => setTimeout(resolve, 60));
