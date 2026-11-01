// Shared by the page tests of the system management pages: signs in as one of the preset
// administrators of the mock backend, tells the Umi stand-in who that is, and puts the sample data
// of the mock backend back.
import { screen, waitFor } from '@testing-library/react';
import { expect } from 'vitest';
import { META_DEFAULTS } from '../../../mock/_core/meta';
import { resetStore } from '../../../mock/_core/store';
import { resetSystemStore, systemState } from '../../../mock/_core/systemData';
import { signInAsAdmin } from '../../../tests/signInAsAdmin';
import { resetUmiStub } from '../../../tests/stubs/umi-max';

export {
  dialogsClosed,
  holdWrites,
  jsonAnswer,
  overrideFetch,
  settled,
  writesOf,
} from '../../../tests/pageHelpers';

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
  return signInAsAdmin(username, {
    codes: options.codes,
    superAdmin: options.superAdmin,
    meta: { ...META_DEFAULTS },
    meExtra:
      options.minLength === null ? {} : { passwordMinLength: options.minLength ?? PASSWORD_MIN },
  });
}

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
