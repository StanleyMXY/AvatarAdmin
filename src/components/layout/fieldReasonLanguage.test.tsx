import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, it, vi } from 'vitest';
import {
  expectFieldReasonsFollowLanguage,
  refuseRequests,
  renderWithLocaleSwitch,
} from '../../../tests/failureLanguage';
import { jsonAnswer, overrideFetch } from '../../../tests/pageHelpers';
import { resetUmiStub } from '../../../tests/stubs/umi-max';
import enUS from '../../locales/en-US';
import zhCN from '../../locales/zh-CN';
import { resetSessionState, setToken } from '../../request/session';
import { ChangePasswordForm } from './ChangePasswordForm';

beforeEach(() => {
  resetUmiStub();
  sessionStorage.clear();
  resetSessionState();
  setToken('tok');
});
afterEach(() => vi.unstubAllGlobals());

async function typeAndSubmit() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(enUS['auth.password.old']), 'old password');
  await user.type(screen.getByLabelText(enUS['auth.password.new']), 'a-new-password-1');
  await user.type(screen.getByLabelText(enUS['auth.password.confirm']), 'a-new-password-1');
  await user.click(document.querySelector('button[type="submit"]') as HTMLElement);
}

describe('the reasons under the fields of the password form follow the language', () => {
  it('the new password that the backend refused', async () => {
    refuseRequests(() => true, [{ ref: 'newPassword', reason: 'TOO_LONG' }]);
    const view = renderWithLocaleSwitch(<ChangePasswordForm onDone={() => {}} />);
    await typeAndSubmit();
    await expectFieldReasonsFollowLanguage(view, { fields: 1 });
  });

  it('the old password that is wrong (a text of the form itself, not of a reason)', async () => {
    overrideFetch(() => jsonAnswer(401, 'ADMIN_INVALID_CREDENTIALS'));
    const view = renderWithLocaleSwitch(<ChangePasswordForm onDone={() => {}} />);
    await typeAndSubmit();
    await expectFieldReasonsFollowLanguage(view, {
      fields: 1,
      words: { en: enUS['auth.password.oldWrong'], zh: zhCN['auth.password.oldWrong'] },
    });
  });
});
