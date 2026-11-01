// Shared by the page tests of this module: the permission helper of the Umi stand-in, a helper that
// picks an option of an Ant Design select, and the sign-in of the mock backend.
import { resetCostStore } from '../../../mock/_core/costData';
import { resetStore } from '../../../mock/_core/store';
import { adminOf } from '../../../mock/_core/testing';
import { signInAs } from '../../../tests/mockBackend';
import { resetUmiStub, setTestAccess, setTestInitialState } from '../../../tests/stubs/umi-max';
import access from '../../access';

export { chooseOption, dialogsClosed } from '../../../tests/pageHelpers';

/** The administrator holds exactly these codes (a super administrator holds all). */
export function holds(codes: string[], meta: Record<string, unknown> = {}, superAdmin = false) {
  const me = {
    id: '1001',
    username: 'tester',
    superAdmin,
    mustChangePassword: false,
    permissions: codes,
  };
  setTestAccess(
    access({ me: { superAdmin, permissions: codes } }) as unknown as Record<string, unknown>,
  );
  setTestInitialState({ me, meta });
}

/** Signs in to the mock backend as one of the preset administrators and sets the Umi stand-in to match. */
export function signIn(
  username: string,
  options: { codes?: string[]; meta?: Record<string, unknown> } = {},
) {
  resetUmiStub();
  resetStore();
  resetCostStore();
  // A preset that is not the super administrator, so that the codes given are the only ones it holds.
  const admin = adminOf(options.codes ? 'support' : username);
  if (options.codes) admin.permissions = options.codes as typeof admin.permissions;
  signInAs(admin.username);
  holds(admin.permissions, options.meta ?? { allowedCurrencies: ['USD'] }, admin.superAdmin);
  return admin;
}

/** The options an opened select offers (call after clicking the select). */
export const optionTexts = (): string[] =>
  [...document.querySelectorAll('.ant-select-item-option-content')].map((o) => o.textContent ?? '');
