import { fireEvent, render, screen, within } from '@testing-library/react';
import { type ReactNode, useEffect } from 'react';
import { IntlProvider } from 'react-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { history, resetUmiStub, setTestLocation } from '../../../tests/stubs/umi-max';
import type { AdminRoute } from '../../access/canAccess';
import { TABS_STORAGE_KEY, TabManager } from './TabManager';

const routes: AdminRoute[] = [
  {
    key: 'dashboard',
    name: 'dashboard',
    routes: [{ path: '/dashboard', name: 'dashboard', component: './dashboard' }],
  },
  {
    key: 'users',
    name: 'users',
    routes: [
      { path: '/users/list', name: 'list', component: './list', access: 'USER:VIEW' },
      { path: '/users/abuse', name: 'abuse', component: './abuse', access: 'ABUSE:VIEW' },
      {
        path: '/users/:id',
        name: 'detail',
        component: './detail',
        access: 'USER:VIEW',
        hideInMenu: true,
      },
    ],
  },
  {
    key: 'system',
    name: 'system',
    routes: [{ path: '/system/audit', name: 'audit', component: './audit', access: 'AUDIT:VIEW' }],
  },
];

const messages = {
  'en-US': {
    'menu.dashboard.dashboard': 'Overview',
    'menu.users.list': 'User list',
    'menu.users.abuse': 'Multi-account',
    'menu.users.detail': 'User detail',
    'menu.system.audit': 'Audit log',
    'pages.tabs.refresh': 'Refresh',
    'pages.tabs.close': 'Close',
    'pages.tabs.closeOthers': 'Close others',
    'pages.tabs.closeAll': 'Close all',
    'pages.tabs.closeLeft': 'Close left',
    'pages.tabs.closeRight': 'Close right',
  },
  'zh-CN': {
    'menu.dashboard.dashboard': '总览',
    'menu.users.list': '用户列表',
    'menu.users.abuse': '多开检测',
    'menu.users.detail': '用户详情',
    'menu.system.audit': '审计日志',
    'pages.tabs.refresh': '刷新',
    'pages.tabs.close': '关闭',
    'pages.tabs.closeOthers': '关闭其他',
    'pages.tabs.closeAll': '关闭全部',
    'pages.tabs.closeLeft': '关闭左侧',
    'pages.tabs.closeRight': '关闭右侧',
  },
};

let mounts = 0;
function Probe() {
  useEffect(() => {
    mounts += 1;
  }, []);
  return <div data-testid="probe" />;
}

const allowAll = () => true;

function Shell({
  locale = 'en-US',
  can = allowAll,
  children = <Probe />,
}: {
  locale?: 'en-US' | 'zh-CN';
  can?: (c?: string) => boolean;
  children?: ReactNode;
}) {
  return (
    <IntlProvider locale={locale} messages={messages[locale]} onError={() => {}}>
      <TabManager routes={routes} can={can} locale={locale}>
        {children}
      </TabManager>
    </IntlProvider>
  );
}

const tabLabels = () =>
  [...document.querySelectorAll('.ant-tabs-tab')].map((el) =>
    el.textContent?.replace(/\s+/g, ' ').trim(),
  );

const tab = (name: string) => {
  const el = [...document.querySelectorAll('.ant-tabs-tab')].find((t) =>
    t.textContent?.includes(name),
  );
  if (!el) throw new Error(`no tab named ${name}`);
  return el as HTMLElement;
};

const visit = (
  pathname: string,
  ui: ReturnType<typeof render>,
  props: Parameters<typeof Shell>[0] = {},
) => {
  setTestLocation({ pathname });
  ui.rerender(<Shell {...props} />);
};

const choose = async (tabName: string, item: string) => {
  fireEvent.contextMenu(tab(tabName));
  const menu = await screen.findByRole('menu');
  fireEvent.click(within(menu).getByText(item));
};

beforeEach(() => {
  resetUmiStub();
  setTestLocation({ pathname: '/dashboard' });
  mounts = 0;
});
afterEach(() => vi.restoreAllMocks());

describe('TabManager: opening tabs', () => {
  it('has the overview tab at the start', () => {
    render(<Shell />);
    expect(tabLabels()).toEqual(['Overview']);
  });

  it('adds a tab for a route that is visited, once however often', () => {
    const ui = render(<Shell />);
    visit('/users/list', ui);
    visit('/dashboard', ui);
    visit('/users/list', ui);
    expect(tabLabels()).toEqual(['Overview', 'User list']);
  });

  it('shows the visited page as the active tab', () => {
    const ui = render(<Shell />);
    visit('/users/list', ui);
    expect(tab('User list').className).toContain('ant-tabs-tab-active');
    expect(tab('Overview').className).not.toContain('ant-tabs-tab-active');
  });

  it('gives each address of a parameter route its own tab', () => {
    const ui = render(<Shell />);
    visit('/users/42', ui);
    visit('/users/43', ui);
    expect(tabLabels()).toEqual(['Overview', 'User detail', 'User detail']);
  });

  it('opens no tab for a path that is not a page, or for a page the administrator may not see', () => {
    const ui = render(<Shell can={(code) => code !== 'AUDIT:VIEW'} />);
    visit('/nowhere', ui, { can: (code) => code !== 'AUDIT:VIEW' });
    visit('/system/audit', ui, { can: (code) => code !== 'AUDIT:VIEW' });
    expect(tabLabels()).toEqual(['Overview']);
  });

  it('shows the page that is open (the children)', () => {
    render(<Shell />);
    expect(screen.getByTestId('probe')).toBeInTheDocument();
  });

  it('opens the page of a tab when it is clicked', () => {
    const ui = render(<Shell />);
    visit('/users/list', ui);
    fireEvent.click(tab('Overview'));
    expect(history.push).toHaveBeenCalledWith('/dashboard');
  });
});

describe('TabManager: closing', () => {
  it('gives the overview tab no close button and every other tab one', () => {
    const ui = render(<Shell />);
    visit('/users/list', ui);
    expect(tab('Overview').querySelector('.ant-tabs-tab-remove')).toBeNull();
    expect(tab('User list').querySelector('.ant-tabs-tab-remove')).not.toBeNull();
  });

  it('closes a tab with its button', () => {
    const ui = render(<Shell />);
    visit('/users/list', ui);
    visit('/dashboard', ui);
    fireEvent.click(tab('User list').querySelector('.ant-tabs-tab-remove') as HTMLElement);
    expect(tabLabels()).toEqual(['Overview']);
  });

  it('after closing the open tab moves to the tab on its left', () => {
    const ui = render(<Shell />);
    visit('/users/list', ui);
    visit('/users/abuse', ui);
    fireEvent.click(tab('Multi-account').querySelector('.ant-tabs-tab-remove') as HTMLElement);
    expect(history.push).toHaveBeenLastCalledWith('/users/list');
  });

  it('does not move when a tab that is not open is closed', () => {
    const ui = render(<Shell />);
    visit('/users/list', ui);
    visit('/users/abuse', ui);
    history.push.mockClear();
    fireEvent.click(tab('User list').querySelector('.ant-tabs-tab-remove') as HTMLElement);
    expect(history.push).not.toHaveBeenCalled();
    expect(tabLabels()).toEqual(['Overview', 'Multi-account']);
  });

  const open4 = () => {
    const ui = render(<Shell />);
    visit('/users/list', ui);
    visit('/users/abuse', ui);
    visit('/system/audit', ui);
    return ui;
  };

  it('close others keeps the overview and that tab only', async () => {
    open4();
    await choose('Multi-account', 'Close others');
    expect(tabLabels()).toEqual(['Overview', 'Multi-account']);
    expect(history.push).toHaveBeenLastCalledWith('/users/abuse');
  });

  it('close all keeps only the overview and goes there', async () => {
    open4();
    await choose('User list', 'Close all');
    expect(tabLabels()).toEqual(['Overview']);
    expect(history.push).toHaveBeenLastCalledWith('/dashboard');
  });

  it('close left removes the tabs to the left of that tab, not the overview', async () => {
    open4();
    await choose('Multi-account', 'Close left');
    expect(tabLabels()).toEqual(['Overview', 'Multi-account', 'Audit log']);
  });

  it('close right removes the tabs to the right of that tab', async () => {
    open4();
    await choose('User list', 'Close right');
    expect(tabLabels()).toEqual(['Overview', 'User list']);
  });

  it('close on one tab from its menu closes just that tab', async () => {
    open4();
    await choose('Multi-account', 'Close');
    expect(tabLabels()).toEqual(['Overview', 'User list', 'Audit log']);
  });

  it('the overview tab menu has no "close" entry', async () => {
    open4();
    fireEvent.contextMenu(tab('Overview'));
    const menu = await screen.findByRole('menu');
    expect(within(menu).queryByText('Close')).toBeNull();
    expect(within(menu).getByText('Refresh')).toBeInTheDocument();
  });
});

describe('TabManager: refresh', () => {
  it('remounts the open page when its tab is refreshed', async () => {
    const ui = render(<Shell />);
    visit('/users/list', ui);
    const before = mounts;
    await choose('User list', 'Refresh');
    expect(mounts).toBe(before + 1);
  });

  it('does not remount the open page when another tab is refreshed, and opens that tab instead', async () => {
    const ui = render(<Shell />);
    visit('/users/list', ui);
    visit('/users/abuse', ui);
    const before = mounts;
    await choose('User list', 'Refresh');
    expect(mounts).toBe(before);
    expect(history.push).toHaveBeenLastCalledWith('/users/list');
  });

  it('does not remount the page on a re-render or a language change', () => {
    const ui = render(<Shell />);
    const before = mounts;
    ui.rerender(<Shell locale="zh-CN" />);
    ui.rerender(<Shell locale="en-US" />);
    expect(mounts).toBe(before);
  });

  it('refreshing twice remounts twice', async () => {
    const ui = render(<Shell />);
    visit('/users/list', ui);
    const before = mounts;
    await choose('User list', 'Refresh');
    await choose('User list', 'Refresh');
    expect(mounts).toBe(before + 2);
  });
});

describe('TabManager: remembering tabs', () => {
  it('saves the tab list in localStorage', () => {
    const ui = render(<Shell />);
    visit('/users/list', ui);
    expect(JSON.parse(localStorage.getItem(TABS_STORAGE_KEY) ?? '[]')).toEqual([
      '/dashboard',
      '/users/list',
    ]);
  });

  it('restores the list after a reload', () => {
    localStorage.setItem(
      TABS_STORAGE_KEY,
      JSON.stringify(['/dashboard', '/users/list', '/system/audit']),
    );
    render(<Shell />);
    expect(tabLabels()).toEqual(['Overview', 'User list', 'Audit log']);
  });

  it('drops the tabs the administrator may not see when restoring', () => {
    localStorage.setItem(
      TABS_STORAGE_KEY,
      JSON.stringify(['/dashboard', '/users/list', '/system/audit']),
    );
    render(<Shell can={(code) => code !== 'AUDIT:VIEW'} />);
    expect(tabLabels()).toEqual(['Overview', 'User list']);
  });

  it('drops saved paths that are no page at all, and anything that is not a text', () => {
    localStorage.setItem(
      TABS_STORAGE_KEY,
      JSON.stringify(['/dashboard', '/gone', 7, null, { a: 1 }, '/users/list']),
    );
    render(<Shell />);
    expect(tabLabels()).toEqual(['Overview', 'User list']);
  });

  it('puts the overview first even when the saved list lacks it or has it elsewhere', () => {
    localStorage.setItem(TABS_STORAGE_KEY, JSON.stringify(['/users/list', '/dashboard']));
    render(<Shell />);
    expect(tabLabels()).toEqual(['Overview', 'User list']);
  });

  it('copes with a saved value that is not JSON or not a list', () => {
    for (const bad of ['not json', '{"a":1}', '"text"', '7', 'null']) {
      localStorage.setItem(TABS_STORAGE_KEY, bad);
      const ui = render(<Shell />);
      expect(tabLabels()).toEqual(['Overview']);
      ui.unmount();
    }
  });

  it('does not crash when localStorage cannot be read or written', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    const ui = render(<Shell />);
    expect(() => visit('/users/list', ui)).not.toThrow();
    expect(tabLabels()).toEqual(['Overview', 'User list']);
  });

  it('does not keep a saved tab list that holds a token or any other data than paths', () => {
    const ui = render(<Shell />);
    visit('/users/list', ui);
    expect(localStorage.getItem(TABS_STORAGE_KEY)).not.toMatch(/token|Bearer/i);
  });
});

describe('TabManager: titles and language', () => {
  it('shows the titles in the current language and changes them when the language changes', () => {
    const ui = render(<Shell />);
    visit('/users/list', ui);
    expect(tabLabels()).toEqual(['Overview', 'User list']);
    ui.rerender(<Shell locale="zh-CN" />);
    expect(tabLabels()).toEqual(['总览', '用户列表']);
    ui.rerender(<Shell locale="en-US" />);
    expect(tabLabels()).toEqual(['Overview', 'User list']);
  });

  it('shows the menu texts of the context menu in the current language', async () => {
    const ui = render(<Shell locale="zh-CN" />);
    visit('/users/list', ui, { locale: 'zh-CN' });
    fireEvent.contextMenu(tab('用户列表'));
    const menu = await screen.findByRole('menu');
    expect(within(menu).getByText('刷新')).toBeInTheDocument();
    expect(within(menu).getByText('关闭其他')).toBeInTheDocument();
  });

  it('shows the path when there is no text for the title, never an empty tab', () => {
    const ui = render(
      <IntlProvider locale="en-US" messages={{}} onError={() => {}}>
        <TabManager routes={routes} can={allowAll} locale="en-US">
          <Probe />
        </TabManager>
      </IntlProvider>,
    );
    setTestLocation({ pathname: '/users/list' });
    ui.rerender(
      <IntlProvider locale="en-US" messages={{}} onError={() => {}}>
        <TabManager routes={routes} can={allowAll} locale="en-US">
          <Probe />
        </TabManager>
      </IntlProvider>,
    );
    expect(tabLabels()).toEqual(['/dashboard', '/users/list']);
  });
});
