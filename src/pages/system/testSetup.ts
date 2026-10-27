// Shared by the page tests of the system management pages: signs in as one of the preset
// administrators of the mock backend, tells the Umi stand-in who that is, and puts the sample data
// of the mock backend back.
import { screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { META_DEFAULTS } from '../../../mock/_core/meta';
import { resetStore } from '../../../mock/_core/store';
import { resetSystemStore, systemState } from '../../../mock/_core/systemData';
import { adminOf } from '../../../mock/_core/testing';
import { signInAs } from '../../../tests/mockBackend';
import { resetUmiStub, setTestAccess, setTestInitialState } from '../../../tests/stubs/umi-max';
import access from '../../access';

export { systemState };

export const PASSWORD_MIN = 12;

export function resetAll(): void {
  resetUmiStub();
  resetStore();
  resetSystemStore();
  localStorage.clear();
}

/**
 * Signs in as `username`. `codes` replaces the permissions of the preset; `superAdmin` replaces its
 * flag. `me` is what `GET /me` gave (the id and the minimum password length included).
 */
export function signIn(
  username: string,
  options: { codes?: string[]; superAdmin?: boolean; minLength?: number | null } = {},
) {
  resetAll();
  const admin = adminOf(username);
  if (options.codes) admin.permissions = options.codes as typeof admin.permissions;
  if (options.superAdmin !== undefined) admin.superAdmin = options.superAdmin;
  signInAs(username);
  const me = {
    id: admin.id,
    username,
    superAdmin: admin.superAdmin,
    mustChangePassword: false,
    permissions: admin.permissions,
    ...(options.minLength === null ? {} : { passwordMinLength: options.minLength ?? PASSWORD_MIN }),
  };
  setTestAccess(access({ me }));
  setTestInitialState({ me, meta: { ...META_DEFAULTS } });
  return admin;
}

/** The calls that changed something. */
export const writesOf = <T extends { method: string }>(calls: T[]) =>
  calls.filter((c) => c.method !== 'GET');

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

/** Makes every write of the page wait until `release()`; `started()` counts the writes handed to the network so far. */
export function holdWrites() {
  const real = globalThis.fetch;
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL, init: RequestInit = {}) => {
      if ((init.method ?? 'GET').toUpperCase() !== 'GET') {
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
 * others. Returns the calls it took.
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

/** Lets the page and the pending promises run before a test counts the requests. */
export const settled = () => new Promise<void>((resolve) => setTimeout(resolve, 60));

/** The text of the rows of the ant table, one array of cell texts per row. */
export const tableRows = () =>
  [...document.querySelectorAll('.ant-table-tbody tr.ant-table-row')].map((tr) =>
    [...tr.querySelectorAll('td')].map((td) => td.textContent ?? ''),
  );

export const waitForRows = (count?: number) =>
  waitFor(() => {
    const rows = tableRows();
    if (count === undefined) expect(rows.length).toBeGreaterThan(0);
    else expect(rows).toHaveLength(count);
  });

/** The row of the table whose first cell holds `text`. */
export const rowOf = async (text: string | RegExp) => {
  await waitFor(() => {
    expect(rowElement(text)).not.toBeNull();
  });
  return rowElement(text) as HTMLTableRowElement;
};

function rowElement(text: string | RegExp): HTMLTableRowElement | null {
  const rows = [
    ...document.querySelectorAll<HTMLTableRowElement>('.ant-table-tbody tr.ant-table-row'),
  ];
  return (
    rows.find((tr) => {
      const first = tr.querySelector('td')?.textContent ?? '';
      return typeof text === 'string' ? first.includes(text) : text.test(first);
    }) ?? null
  );
}

export { screen };
