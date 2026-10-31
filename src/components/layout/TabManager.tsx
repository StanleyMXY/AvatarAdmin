import { history, useIntl, useLocation } from '@umijs/max';
import { Dropdown, Tabs } from 'antd';
import { Fragment, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import type { AdminRoute } from '../../access/canAccess';
import { markServiceReachable } from '../../request/serviceStatus';
import { indexPages, matchPage, pageIdentifier, titleWithIdentifier } from './pageIndex';
import { ServiceNotice } from './ServiceNotice';

export const TABS_STORAGE_KEY = 'avatar-admin.tabs';

/** The overview tab: always the first, never closed. */
const PINNED = '/dashboard';

type Props = {
  routes: AdminRoute[];
  can: (code?: string) => boolean;
  /** The language in use; titles are written again when it changes. */
  locale: string;
  children: ReactNode;
};

const trimSlash = (path: string) => (path.length > 1 ? path.replace(/\/+$/, '') : path);

function readSaved(): unknown {
  try {
    return JSON.parse(localStorage.getItem(TABS_STORAGE_KEY) ?? 'null');
  } catch {
    return null;
  }
}

function save(tabs: string[]): void {
  try {
    localStorage.setItem(TABS_STORAGE_KEY, JSON.stringify(tabs));
  } catch {
    // the tabs are then not remembered across a reload
  }
}

/**
 * The tabs of the pages that were opened, above the page. No page is kept alive: a tab that is shown
 * again loads its page again, and "refresh" does that on purpose. The list is kept in localStorage
 * (paths only) and, when read back, drops what the administrator may no longer open.
 */
export function TabManager({ routes, can, locale, children }: Props) {
  const intl = useIntl();
  const { pathname: rawPath } = useLocation();
  const pathname = trimSlash(rawPath);
  const pages = useMemo(() => indexPages(routes), [routes]);

  const allowed = useCallback(
    (path: string) => {
      const page = matchPage(pages, path);
      return page !== undefined && can(page.access);
    },
    [pages, can],
  );

  const [tabs, setTabs] = useState<string[]>(() => {
    const saved = readSaved();
    const paths = Array.isArray(saved)
      ? saved.filter((p): p is string => typeof p === 'string')
      : [];
    const kept = [...new Set(paths.map(trimSlash))].filter((p) => p !== PINNED && allowed(p));
    return allowed(PINNED) ? [PINNED, ...kept] : kept;
  });
  const [refreshKeys, setRefreshKeys] = useState<Record<string, number>>({});

  // A page that is opened gets a tab.
  useEffect(() => {
    if (allowed(pathname))
      setTabs((previous) => (previous.includes(pathname) ? previous : [...previous, pathname]));
  }, [pathname, allowed]);

  // A tab the administrator may no longer open goes (permissions can change while the page is open).
  useEffect(() => {
    setTabs((previous) => {
      const next = previous.filter(allowed);
      return next.length === previous.length ? previous : next;
    });
  }, [allowed]);

  useEffect(() => save(tabs), [tabs]);

  // The notice about an unavailable service belongs to the page that was open when it came up.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the address changes
  useEffect(() => markServiceReachable(), [pathname]);

  const active = tabs.includes(pathname) ? pathname : undefined;
  const open = (path: string) => history.push(path);

  const titleOf = (path: string) => {
    const key = matchPage(pages, path)?.titleKey;
    return key && intl.messages[key]
      ? titleWithIdentifier(intl.formatMessage({ id: key }), pageIdentifier(pages, path))
      : path;
  };

  const closeTabs = (keep: (path: string, index: number) => boolean, goTo: string) => {
    const next = tabs.filter((path, index) => path === PINNED || keep(path, index));
    setTabs(next);
    if (active !== undefined && !next.includes(active)) open(goTo);
  };

  const close = (path: string) => {
    if (path === PINNED) return;
    const index = tabs.indexOf(path);
    const left = tabs[index - 1] ?? PINNED;
    closeTabs((p) => p !== path, left);
  };

  const refresh = (path: string) => {
    setRefreshKeys((previous) => ({ ...previous, [path]: (previous[path] ?? 0) + 1 }));
    if (path !== active) open(path);
  };

  const menuFor = (path: string) => {
    const index = tabs.indexOf(path);
    const text = (id: string) => intl.formatMessage({ id });
    const items = [
      { key: 'refresh', label: text('pages.tabs.refresh'), onClick: () => refresh(path) },
      ...(path === PINNED
        ? []
        : [{ key: 'close', label: text('pages.tabs.close'), onClick: () => close(path) }]),
      {
        key: 'others',
        label: text('pages.tabs.closeOthers'),
        onClick: () => closeTabs((p) => p === path, path),
      },
      {
        key: 'all',
        label: text('pages.tabs.closeAll'),
        onClick: () => closeTabs(() => false, PINNED),
      },
      {
        key: 'left',
        label: text('pages.tabs.closeLeft'),
        onClick: () => closeTabs((_p, i) => i >= index, path),
      },
      {
        key: 'right',
        label: text('pages.tabs.closeRight'),
        onClick: () => closeTabs((_p, i) => i <= index, path),
      },
    ];
    return { items };
  };

  const items = tabs.map((path) => ({
    key: path,
    closable: path !== PINNED,
    label: <span data-locale={locale}>{titleOf(path)}</span>,
  }));

  return (
    <>
      <Tabs
        type="editable-card"
        hideAdd
        size="small"
        activeKey={active ?? ''}
        items={items}
        renderTabBar={(props, DefaultTabBar) => (
          <DefaultTabBar {...props}>
            {(node) => (
              // The wrapper has no box of its own; it only lets a right click anywhere on the tab open the menu.
              <Dropdown key={node.key} trigger={['contextMenu']} menu={menuFor(String(node.key))}>
                <span style={{ display: 'contents' }}>{node}</span>
              </Dropdown>
            )}
          </DefaultTabBar>
        )}
        onChange={open}
        onEdit={(key, action) => {
          if (action === 'remove' && typeof key === 'string') close(key);
        }}
      />
      <ServiceNotice
        onRetry={() => {
          markServiceReachable();
          refresh(active ?? pathname);
        }}
      />
      <Fragment key={`${active ?? pathname}#${refreshKeys[active ?? pathname] ?? 0}`}>
        {children}
      </Fragment>
    </>
  );
}
