import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLocale, history, resetUmiStub } from '../../../tests/stubs/umi-max';
import { currentLocale, resetActiveLocaleForTests } from '../../locales/activeLocale';
import { getToken, setToken } from '../../request/session';
import { resetThemeModeForTests, THEME_STORAGE_KEY } from '../../theme/modes';
import { HeaderDropdown } from './HeaderDropdown';
import { LangSwitch } from './LangSwitch';
import { signOut } from './signOut';
import { TABS_STORAGE_KEY } from './TabManager';
import { ThemeSwitch } from './ThemeSwitch';

const messages = {
  'pages.theme.dim': 'Dim',
  'pages.theme.deep': 'Deep',
  'pages.theme.light': 'Light',
  'pages.theme.label': 'Theme',
  'pages.lang.zhCN': '简体中文',
  'pages.lang.enUS': 'English',
  'pages.lang.label': 'Language',
  'pages.header.changePassword': 'Change password',
  'pages.header.logout': 'Sign out',
};

const wrap = (ui: React.ReactElement) => (
  <IntlProvider locale="en-US" messages={messages} onError={() => {}}>
    {ui}
  </IntlProvider>
);

beforeEach(() => {
  resetUmiStub();
  resetThemeModeForTests();
});

describe('ThemeSwitch', () => {
  it('offers the three modes and marks the current one', () => {
    render(wrap(<ThemeSwitch />));
    for (const label of ['Dim', 'Deep', 'Light'])
      expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByText('Dim').closest('.ant-segmented-item')?.className).toContain('selected');
  });

  it('changes the mode and keeps it, without reloading the page', () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    render(wrap(<ThemeSwitch />));
    fireEvent.click(screen.getByText('Light'));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(screen.getByText('Light').closest('.ant-segmented-item')?.className).toContain(
      'selected',
    );
    expect(reload).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('has an accessible name for the control', () => {
    render(wrap(<ThemeSwitch />));
    expect(screen.getByLabelText('Theme')).toBeInTheDocument();
  });
});

describe('LangSwitch', () => {
  it('shows the current language', () => {
    render(wrap(<LangSwitch />));
    expect(screen.getByText('English')).toBeInTheDocument();
  });

  it('changes the language through Umi without a page reload', async () => {
    render(wrap(<LangSwitch />));
    fireEvent.mouseDown(screen.getByRole('combobox'));
    fireEvent.click(
      await screen.findByText('简体中文', { selector: '.ant-select-item-option-content' }),
    );
    expect(getLocale()).toBe('zh-CN');
    expect(document.documentElement.lang).toBe('zh-CN');
  });

  it('records the choice for the app even when the browser refuses to save it, so the drop-down and the requests agree with the page', async () => {
    resetActiveLocaleForTests();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    render(wrap(<LangSwitch />));
    fireEvent.mouseDown(screen.getByRole('combobox'));
    fireEvent.click(
      await screen.findByText('简体中文', { selector: '.ant-select-item-option-content' }),
    );
    expect(currentLocale()).toBe('zh-CN');
    expect(document.documentElement.lang).toBe('zh-CN');
    resetActiveLocaleForTests();
    vi.restoreAllMocks();
  });

  it('offers exactly the two interface languages, each in its own language', async () => {
    render(wrap(<LangSwitch />));
    fireEvent.mouseDown(screen.getByRole('combobox'));
    const options = await screen.findAllByRole('option', { hidden: true });
    const names = options.map((o) => o.getAttribute('aria-label') ?? o.textContent);
    expect(names.sort()).toEqual(['English', '简体中文']);
  });
});

describe('HeaderDropdown', () => {
  const open = async (onChangePassword = vi.fn(), onLogout = vi.fn()) => {
    render(
      wrap(
        <HeaderDropdown username="ploy" onChangePassword={onChangePassword} onLogout={onLogout} />,
      ),
    );
    fireEvent.click(screen.getByTestId('header-avatar'));
    return { menu: await screen.findByRole('menu'), onChangePassword, onLogout };
  };

  it('shows the first letter of the user name, whatever the script', () => {
    for (const [name, letter] of [
      ['ploy', 'P'],
      ['สมชาย', 'ส'],
      ['أحمد', 'أ'],
      ['王小明', '王'],
      ['😀x', '😀'],
    ] as const) {
      const { unmount } = render(
        wrap(<HeaderDropdown username={name} onChangePassword={() => {}} onLogout={() => {}} />),
      );
      expect(screen.getByTestId('header-avatar').textContent).toBe(letter);
      unmount();
    }
  });

  it('has change password and sign out, and calls the right one', async () => {
    const { menu, onChangePassword, onLogout } = await open();
    fireEvent.click(within(menu).getByText('Change password'));
    expect(onChangePassword).toHaveBeenCalledTimes(1);
    expect(onLogout).not.toHaveBeenCalled();
    act(() => {});
    fireEvent.click(screen.getByTestId('header-avatar'));
    fireEvent.click(within(await screen.findByRole('menu')).getByText('Sign out'));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('opens from a focusable button named by the user name, so the keyboard reaches it', async () => {
    render(
      wrap(<HeaderDropdown username="ploy" onChangePassword={() => {}} onLogout={() => {}} />),
    );
    const trigger = screen.getByRole('button', { name: /ploy/ });
    expect(trigger.tagName).toBe('BUTTON');
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    trigger.focus();
    expect(document.activeElement).toBe(trigger);
    fireEvent.click(trigger);
    expect(await screen.findByRole('menu')).toBeInTheDocument();
  });

  it('shows the user name next to the avatar', () => {
    render(
      wrap(<HeaderDropdown username="ploy" onChangePassword={() => {}} onLogout={() => {}} />),
    );
    expect(screen.getByText('ploy')).toBeInTheDocument();
  });
});

describe('signOut', () => {
  it('forgets the token and the remembered tabs and goes to the sign-in page', () => {
    setToken('tok');
    localStorage.setItem(TABS_STORAGE_KEY, JSON.stringify(['/dashboard', '/users/list']));
    signOut();
    expect(getToken()).toBeNull();
    expect(sessionStorage.getItem('avatar-admin.token')).toBeNull();
    expect(localStorage.getItem(TABS_STORAGE_KEY)).toBeNull();
    expect(history.replace).toHaveBeenCalledWith('/user/login');
  });

  it('works when localStorage cannot be written', () => {
    setToken('tok');
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(() => signOut()).not.toThrow();
    expect(getToken()).toBeNull();
    expect(history.replace).toHaveBeenCalledWith('/user/login');
  });
});
