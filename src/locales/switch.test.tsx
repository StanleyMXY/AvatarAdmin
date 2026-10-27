import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from 'antd';
import type { ReactElement } from 'react';
import { IntlProvider } from 'react-intl';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetUmiStub, setTestInitialState, setTestLocation } from '../../tests/stubs/umi-max';
import { ReasonModalForm } from '../components/ReasonModalForm';
import Login from '../pages/user/login/index';
import { resetSessionState } from '../request/session';
import enUS from './en-US';
import zhCN from './zh-CN';

// Spec section 12: after the language is switched the menu, the tab titles and the form validation
// texts follow, with no text of the other language left behind. The switch keeps the page mounted
// (Umi only gives the provider new messages), so it is drawn again here the same way.
const draw = (locale: 'en-US' | 'zh-CN', ui: ReactElement) => (
  <IntlProvider locale={locale} messages={locale === 'en-US' ? enUS : zhCN} onError={() => {}}>
    <App>{ui}</App>
  </IntlProvider>
);

// Ant Design writes a space between the two characters of a button text in Chinese.
const spaced = (text: string) => new RegExp([...text].join('\\s?'));

beforeEach(() => {
  resetUmiStub();
  sessionStorage.clear();
  localStorage.clear();
  resetSessionState();
  setTestInitialState({});
  setTestLocation({ pathname: '/user/login', search: '' });
});

describe('validation texts after a language switch', () => {
  it('sign-in form: a check made after the switch is written in the new language only', async () => {
    const user = userEvent.setup();
    const { rerender } = render(draw('en-US', <Login />));
    rerender(draw('zh-CN', <Login />));
    await user.click(screen.getByRole('button', { name: spaced(zhCN['auth.login.submit']) }));
    expect(await screen.findByText(zhCN['auth.login.usernameRequired'])).toBeInTheDocument();
    expect(screen.getByText(zhCN['auth.login.passwordRequired'])).toBeInTheDocument();
    expect(screen.queryByText(enUS['auth.login.usernameRequired'])).toBeNull();
  });

  it('reason dialog: a check made after the switch is written in the new language only', async () => {
    const dialog = <ReasonModalForm open title="x" onSubmit={async () => {}} onClose={() => {}} />;
    const { rerender } = render(draw('en-US', dialog));
    rerender(draw('zh-CN', dialog));
    fireEvent.click(screen.getByRole('button', { name: spaced(zhCN['pages.common.submit']) }));
    expect(await screen.findByText(zhCN['pages.common.reasonRequired'])).toBeInTheDocument();
    expect(screen.queryByText(enUS['pages.common.reasonRequired'])).toBeNull();
  });

  // antd keeps the text of a message that a form has already shown; `RevalidateOnLocaleChange` checks
  // the fields that show a message again when the language changes, keeping what was typed.
  it('sign-in form: a message that is already on screen is written again in the new language', async () => {
    const user = userEvent.setup();
    const { rerender } = render(draw('en-US', <Login />));
    await user.click(screen.getByRole('button', { name: enUS['auth.login.submit'] }));
    expect(await screen.findByText(enUS['auth.login.usernameRequired'])).toBeInTheDocument();
    rerender(draw('zh-CN', <Login />));
    expect(await screen.findByText(zhCN['auth.login.usernameRequired'])).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(enUS['auth.login.usernameRequired'])).toBeNull());
  });

  it('reason dialog: a message that is already on screen is written again, and the typed text stays', async () => {
    const user = userEvent.setup();
    const dialog = <ReasonModalForm open title="x" onSubmit={async () => {}} onClose={() => {}} />;
    const { rerender } = render(draw('en-US', dialog));
    await user.type(screen.getByRole('textbox'), '   ');
    await user.click(screen.getByRole('button', { name: enUS['pages.common.submit'] }));
    expect(await screen.findByText(enUS['pages.common.reasonRequired'])).toBeInTheDocument();
    rerender(draw('zh-CN', dialog));
    expect(await screen.findByText(zhCN['pages.common.reasonRequired'])).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(enUS['pages.common.reasonRequired'])).toBeNull());
    expect(screen.getByRole('textbox')).toHaveValue('   ');
  });
});
