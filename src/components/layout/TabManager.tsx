import { history, useIntl, useLocation } from '@umijs/max';
import { Dropdown, Tabs } from 'antd';
import { Fragment, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AdminRoute } from '../../access/canAccess';
import { useConfirmDiscard } from '../../hooks/useLeaveGuard';
import { markServiceReachable } from '../../request/serviceStatus';
import { indexPages, matchPage, pageIdentifier, titleWithIdentifier } from './pageIndex';
import { ServiceNotice } from './ServiceNotice';

export const TABS_STORAGE_KEY = 'avatar-admin.tabs';

/** The overview tab: always the first, never closed. */
const PINNED = '/dashboard';

/** How long a finger stays on a tab before the menu opens (a touch screen has no right click). */
const LONG_PRESS_MS = 500;
/** A finger that moves further than this many pixels is scrolling, not pressing. */
const LONG_PRESS_SLOP = 10;

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
  // The tab whose menu is open. Besides the right click, the menu key of the keyboard, Shift+F10 and
  // a long press open it, so the entries (refresh, close others ...) do not need a mouse.
  const [menuPath, setMenuPath] = useState<string | null>(null);
  const press = useRef<{ timer: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null);
  const pressed = useRef(false);
  // The element that had the focus when the menu was opened with a key; it gets the focus back.
  const focusBack = useRef<HTMLElement | null>(null);
  const confirmDiscard = useConfirmDiscard();
  const cancelPress = useCallback(() => {
    if (press.current) clearTimeout(press.current.timer);
    press.current = null;
  }, []);
  useEffect(() => cancelPress, [cancelPress]);

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
    const dropsOpenPage = active !== undefined && !next.includes(active);
    const apply = () => {
      setTabs(next);
      if (dropsOpenPage) open(goTo);
    };
    // The open page goes with its tab: when it holds changes that are not saved, the tabs stay as
    // they are until the person agrees to lose them (after "Stay" the tab must still be there).
    if (dropsOpenPage) confirmDiscard(apply);
    else apply();
  };

  const close = (path: string) => {
    if (path === PINNED) return;
    const index = tabs.indexOf(path);
    const left = tabs[index - 1] ?? PINNED;
    closeTabs((p) => p !== path, left);
  };

  /** Draws the page of `path` again, from nothing. */
  const reload = (path: string) =>
    setRefreshKeys((previous) => ({ ...previous, [path]: (previous[path] ?? 0) + 1 }));

  const refresh = (path: string) => {
    reload(path);
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
            {(node) => {
              const path = String(node.key);
              return (
                <Dropdown
                  key={node.key}
                  trigger={['contextMenu']}
                  // The focus goes into the menu, so that the arrow keys and Enter work after the menu key.
                  autoFocus
                  open={menuPath === path}
                  onOpenChange={(open) => {
                    setMenuPath((current) => (open ? path : current === path ? null : current));
                    const back = focusBack.current;
                    if (open || !back) return;
                    focusBack.current = null;
                    // Closed with Escape (or after an entry was chosen): the focus was in the menu and
                    // would be lost; it goes back to the tab. A click somewhere else keeps its own focus.
                    setTimeout(() => {
                      const now = document.activeElement;
                      if (
                        back.isConnected &&
                        (!now || now === document.body || now.closest('.ant-dropdown'))
                      )
                        back.focus();
                    }, 0);
                  }}
                  menu={menuFor(path)}
                >
                  {/* The wrapper lets a right click anywhere on the tab open the menu, and receives the keys
                      and touches that bubble up from the tab itself. It must have a box (not display:
                      contents): the menu is placed by it when it is opened without a mouse position. */}
                  {/* biome-ignore lint/a11y/noStaticElementInteractions: the interactive element is the tab inside it; this only listens to what bubbles up */}
                  <span
                    style={{ display: 'inline-flex' }}
                    onKeyDown={(event) => {
                      if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
                        event.preventDefault();
                        if (event.target instanceof HTMLElement) focusBack.current = event.target;
                        setMenuPath(path);
                      }
                    }}
                    onTouchStart={(event) => {
                      cancelPress();
                      pressed.current = false;
                      const touch = event.touches[0];
                      if (event.touches.length !== 1 || !touch) return;
                      press.current = {
                        x: touch.clientX,
                        y: touch.clientY,
                        timer: setTimeout(() => {
                          press.current = null;
                          pressed.current = true;
                          setMenuPath(path);
                        }, LONG_PRESS_MS),
                      };
                    }}
                    onTouchMove={(event) => {
                      const touch = event.touches[0];
                      const start = press.current;
                      if (
                        start &&
                        touch &&
                        Math.hypot(touch.clientX - start.x, touch.clientY - start.y) >
                          LONG_PRESS_SLOP
                      ) {
                        cancelPress();
                      }
                    }}
                    onTouchEnd={(event) => {
                      cancelPress();
                      // The lift after a long press must not also count as a tap on the tab.
                      if (pressed.current && event.cancelable) event.preventDefault();
                      pressed.current = false;
                    }}
                    onTouchCancel={() => {
                      cancelPress();
                      pressed.current = false;
                    }}
                  >
                    {node}
                  </span>
                </Dropdown>
              );
            }}
          </DefaultTabBar>
        )}
        onChange={open}
        onEdit={(key, action) => {
          if (action === 'remove' && typeof key === 'string') close(key);
        }}
      />
      <ServiceNotice
        // Drawing the page again drops what was typed in it: ask first, as for a move to another page.
        onRetry={() =>
          confirmDiscard(() => {
            markServiceReachable();
            reload(active ?? pathname);
          })
        }
      />
      <Fragment key={`${active ?? pathname}#${refreshKeys[active ?? pathname] ?? 0}`}>
        {children}
      </Fragment>
    </>
  );
}
