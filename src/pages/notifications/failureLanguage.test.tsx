import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, it, vi } from 'vitest';
import { USER } from '../../../mock/_core/usersData';
import notificationsMock from '../../../mock/notifications.mock';
import {
  expectFailureFollowsLanguage,
  failRequests,
  renderWithLocaleSwitch,
} from '../../../tests/failureLanguage';
import { envelope, jsonResponse } from '../../../tests/httpStubs';
import { useMockBackend } from '../../../tests/mockBackend';
import { overrideFetch } from '../../../tests/pageHelpers';
import enUS from '../../locales/en-US';
import zhCN from '../../locales/zh-CN';
import { NotificationDrawer } from './NotificationDrawer';
import { SendModal } from './SendModal';
import { notificationsState, signIn } from './testSetup';

beforeEach(() => signIn('root'));
afterEach(() => vi.unstubAllGlobals());

const noop = () => {};

describe('the failures of the notification pages follow the language', () => {
  it('the message that could not be read', async () => {
    useMockBackend({ default: notificationsMock });
    failRequests(/GET .*notifications\/\w+/);
    const view = renderWithLocaleSwitch(
      <NotificationDrawer id={notificationsState.rows[0].id} onClose={noop} />,
    );
    await expectFailureFollowsLanguage(view);
  });

  it('the send that failed', async () => {
    useMockBackend({ default: notificationsMock });
    failRequests((path, method) => method === 'POST' && path.includes('notifications/send'));
    const user = userEvent.setup();
    const view = renderWithLocaleSwitch(<SendModal onClose={noop} onSent={noop} />);
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Recipients' }), {
      target: { value: USER.rich },
    });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Title (en)' }), {
      target: { value: 'Hello' },
    });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Body (en)' }), {
      target: { value: 'A message' },
    });
    await user.click(within(dialog).getByRole('button', { name: 'Send' }));
    await expectFailureFollowsLanguage(view);
  });

  it('the send that was refused for a recipient and for a text', async () => {
    useMockBackend({ default: notificationsMock });
    overrideFetch(({ url, method }) =>
      method === 'POST' && url.pathname.includes('notifications/send')
        ? jsonResponse(
            400,
            envelope('INVALID_REQUEST', {
              details: [
                { ref: USER.rich, reason: 'NOT_FOUND' },
                { ref: 'titleI18n.en', reason: 'TOO_LONG' },
              ],
            }),
          )
        : undefined,
    );
    const user = userEvent.setup();
    const view = renderWithLocaleSwitch(<SendModal onClose={noop} onSent={noop} />);
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Recipients' }), {
      target: { value: USER.rich },
    });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Title (en)' }), {
      target: { value: 'Hello' },
    });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Body (en)' }), {
      target: { value: 'A message' },
    });
    await user.click(within(dialog).getByRole('button', { name: 'Send' }));
    await expectFailureFollowsLanguage(view, {
      words: { en: enUS['reason.TOO_LONG'], zh: zhCN['reason.TOO_LONG'] },
    });
  });
});
