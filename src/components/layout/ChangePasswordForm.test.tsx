import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { renderPage } from '../../../tests/renderPage';
import { resetUmiStub } from '../../../tests/stubs/umi-max';
import enUS from '../../locales/en-US';
import zhCN from '../../locales/zh-CN';
import { resetSessionState, setToken } from '../../request/session';
import { ChangePasswordForm } from './ChangePasswordForm';

// A sentence of the server in English, in whatever language the console is shown.
const SERVER_SENTENCE = 'newPassword must have at least 14 characters';

beforeEach(() => {
  resetUmiStub();
  sessionStorage.clear();
  resetSessionState();
  setToken('tok');
});
afterEach(() => vi.unstubAllGlobals());

async function submit(language: 'en-US' | 'zh-CN') {
  const text = language === 'en-US' ? enUS : zhCN;
  const user = userEvent.setup();
  renderPage(<ChangePasswordForm onDone={() => {}} />, language);
  await user.type(screen.getByLabelText(text['auth.password.old']), 'old password');
  await user.type(screen.getByLabelText(text['auth.password.new']), 'a-new-password-1');
  await user.type(screen.getByLabelText(text['auth.password.confirm']), 'a-new-password-1');
  const button = document.querySelector('button[type="submit"]') as HTMLElement;
  await user.click(button);
}

describe('ChangePasswordForm: a rejected request (INVALID_REQUEST)', () => {
  it.each([
    ['en-US', enUS],
    ['zh-CN', zhCN],
  ] as const)(
    'shows only the text of the error code in %s when the server named no reason',
    async (language, text) => {
      stubFetch(() =>
        jsonResponse(400, envelope('INVALID_REQUEST', { details: [] }, SERVER_SENTENCE)),
      );
      await submit(language);
      expect(await screen.findByText(text['error.INVALID_REQUEST'])).toBeInTheDocument();
      expect(document.body.textContent).not.toContain(SERVER_SENTENCE);
    },
  );

  it.each([
    ['en-US', enUS],
    ['zh-CN', zhCN],
  ] as const)(
    'translates the reason code of a detail that names no password field, in %s, and not the server sentence',
    async (language, text) => {
      stubFetch(() =>
        jsonResponse(
          400,
          envelope(
            'INVALID_REQUEST',
            { details: [{ ref: 'password', reason: 'TOO_LONG' }] },
            SERVER_SENTENCE,
          ),
        ),
      );
      await submit(language);
      const bar = await screen.findByRole('alert');
      expect(bar.textContent).toContain(text['error.INVALID_REQUEST']);
      expect(bar.textContent).toContain(text['reason.TOO_LONG']);
      expect(document.body.textContent).not.toContain(SERVER_SENTENCE);
    },
  );

  it('shows only the text of the error code when the reason is one it has no translation for', async () => {
    stubFetch(() =>
      jsonResponse(
        400,
        envelope(
          'INVALID_REQUEST',
          { details: [{ ref: 'password', reason: 'SOMETHING_NEW' }] },
          SERVER_SENTENCE,
        ),
      ),
    );
    await submit('en-US');
    expect(await screen.findByText(enUS['error.INVALID_REQUEST'])).toBeInTheDocument();
    expect(document.body.textContent).not.toContain(SERVER_SENTENCE);
    expect(document.body.textContent).not.toContain('SOMETHING_NEW');
  });
});
