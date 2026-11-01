import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from 'antd';
import { IntlProvider } from 'react-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import activityMock from '../../../mock/activity.mock';
import { useMockBackend } from '../../../tests/mockBackend';
import enUS from '../../locales/en-US';
import SigninConfigPage from './signinConfig';
import { signIn } from './testSetup';

beforeEach(() => signIn('root'));
afterEach(() => vi.unstubAllGlobals());

const VIETNAMESE =
  'Ứng dụng này giúp tôi nói chuyện với bạn bè mỗi ngày một cách dễ dàng và vui vẻ';

/**
 * In the running app the Ant Design `App` (whose holder draws `modal.confirm`) sits outside the
 * language context: `ThemeRoot` wraps the whole app and Umi's language provider is inside it. The
 * shared `renderPage` puts them the other way round, so a question whose body asks for the language
 * context works there and fails in the app. This renders in the order of the app.
 */
function renderInAppOrder(ui: React.ReactElement) {
  return render(
    <App>
      <IntlProvider locale="en-US" messages={enUS} onError={() => {}}>
        {ui}
      </IntlProvider>
    </App>,
  );
}

describe('the overlap question in the order the app puts its providers', { timeout: 30000 }, () => {
  it('opens with the names of the activities that will be stopped, without a language context of its own', async () => {
    useMockBackend({ default: activityMock });
    const user = userEvent.setup();
    renderInAppOrder(<SigninConfigPage />);
    const row = (await screen.findAllByText(VIETNAMESE))
      .map((el) => el.closest('tr'))
      .find((tr): tr is HTMLTableRowElement => tr !== null) as HTMLElement;
    await user.click(within(row).getByRole('button', { name: 'More' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Publish' }));
    const question = await waitFor(() => {
      const found = screen
        .getAllByRole('dialog')
        .find(
          (d) => within(d).queryAllByText('Enable it and stop the overlapping activities?').length,
        );
      if (!found) throw new Error('no question');
      return found;
    });
    expect(within(question).getByText('Autumn check-in 🍂')).toBeInTheDocument();
  });
});
