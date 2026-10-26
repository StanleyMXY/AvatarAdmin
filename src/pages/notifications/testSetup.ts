// Shared by the page tests of the notification page: signs in as one of the preset administrators
// of the mock backend and tells the Umi stand-in who that is, so that buttons follow the
// administrator's codes and the values of `GET /meta`.
import { screen } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';
import { META_DEFAULTS } from '../../../mock/_core/meta';
import { notificationsState, resetNotificationsStore } from '../../../mock/_core/notificationsData';
import { resetStore } from '../../../mock/_core/store';
import { adminOf } from '../../../mock/_core/testing';
import { signInAs } from '../../../tests/mockBackend';
import { resetUmiStub, setTestAccess, setTestInitialState } from '../../../tests/stubs/umi-max';
import access from '../../access';

export { notificationsState };

/** The values of `GET /meta` with three supported languages. */
export const META = { ...META_DEFAULTS, supportedLocales: ['en', 'th', 'ar'] };

/** Signs in as `username`; `codes` replaces the preset's permissions; `meta` replaces the values of `GET /meta`. */
export function signIn(
  username: string,
  options: { codes?: string[]; meta?: Record<string, unknown> | null } = {},
) {
  resetUmiStub();
  resetStore();
  resetNotificationsStore();
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
  setTestInitialState({ me, meta: options.meta === null ? undefined : (options.meta ?? META) });
  return admin;
}

/** Opens an Ant Design select by its label and clicks the option with this text. */
export async function chooseOption(
  user: ReturnType<typeof userEvent.setup>,
  label: string | RegExp,
  optionText: string | RegExp,
) {
  await user.click(screen.getByRole('combobox', { name: label }));
  const options = await screen.findAllByText(optionText, {
    selector: '.ant-select-item-option-content',
  });
  await user.click(options[options.length - 1]);
}

/** The calls that changed something. */
export const writesOf = <T extends { method: string }>(calls: T[]) =>
  calls.filter((c) => c.method !== 'GET');
