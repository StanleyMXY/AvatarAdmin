// Shared by the page tests of the campaign module: signs in as one of the preset administrators of
// the mock backend, tells the Umi stand-in who that is, and puts the sample data of the mock
// backend back.
import { within as scoped, screen, waitFor } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { resetCampaignStore } from '../../../mock/_core/campaignData';
import { resetConfigStore } from '../../../mock/_core/configStore';
import { META_DEFAULTS } from '../../../mock/_core/meta';
import { resetStore } from '../../../mock/_core/store';
import { adminOf } from '../../../mock/_core/testing';
import { signInAs } from '../../../tests/mockBackend';
import { resetUmiStub, setTestAccess, setTestInitialState } from '../../../tests/stubs/umi-max';
import access from '../../access';
import { resetChannelsCache } from '../../components/ChannelSelect';

/** The values of `GET /meta`. */
export const META = { ...META_DEFAULTS };

export const NOW = new Date('2026-10-26T10:00:00Z');

export function resetAll(): void {
  resetUmiStub();
  resetStore();
  resetConfigStore();
  resetCampaignStore(NOW);
  resetChannelsCache();
  localStorage.clear();
}

/**
 * Signs in as `username`; `codes` replaces the preset's permissions; `meta` replaces the values of
 * `GET /meta`.
 */
export function signIn(
  username: string,
  options: { codes?: string[]; meta?: Record<string, unknown> } = {},
) {
  resetAll();
  const admin = adminOf(username);
  if (options.codes) admin.permissions = options.codes as typeof admin.permissions;
  signInAs(username);
  const me = {
    id: admin.id,
    username,
    superAdmin: admin.superAdmin,
    mustChangePassword: false,
    permissions: admin.permissions,
  };
  setTestAccess(access({ me }));
  setTestInitialState({ me, meta: options.meta ?? META });
  return admin;
}

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
export const writesOf = <T extends { method: string; url: string }>(calls: T[]) =>
  calls.filter((c) => c.method !== 'GET');

/**
 * Makes every write of the page wait until `release()`, so that a second press can come while the
 * first request is still on its way. Call it after `useMockBackend`. `started()` counts the writes
 * that have been handed to the network so far.
 */
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

export const SHEET_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** The answer of an export: the first bytes of a spreadsheet. */
export const sheetAnswer = (name = 'attribution-performance') =>
  new Response(Uint8Array.from([80, 75, 3, 4]), {
    status: 200,
    headers: {
      'content-type': SHEET_TYPE,
      'content-disposition': `attachment; filename="${name}.xlsx"`,
    },
  });
