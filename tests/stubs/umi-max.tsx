/**
 * Stand-in for `@umijs/max` in component tests. Application code imports the real package name;
 * vitest.config.ts aliases it here. Tests steer the stub through the `setTest*` helpers and call
 * `resetUmiStub()` in `beforeEach`. Extend this file (task owners only, see the execution
 * conventions) when a page needs another Umi export.
 */
import { type AnchorHTMLAttributes, type ReactNode, useSyncExternalStore } from 'react';
import { FormattedMessage, IntlProvider, useIntl } from 'react-intl';
import { vi } from 'vitest';

export { FormattedMessage, IntlProvider, useIntl };

// ---- tiny observable store so hooks re-render when a test changes state ----
type Listener = () => void;
function createStore<T>(initial: () => T) {
  let value = initial();
  const listeners = new Set<Listener>();
  return {
    get: () => value,
    set(next: T) {
      value = next;
      for (const listener of listeners) listener();
    },
    reset() {
      value = initial();
      for (const listener of listeners) listener();
    },
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

const accessStore = createStore<Record<string, unknown>>(() => ({}));
const initialStateStore = createStore<Record<string, unknown> | undefined>(() => undefined);
type StubLocation = { pathname: string; search: string; hash: string; state: unknown; key: string };
const locationStore = createStore<StubLocation>(() => ({
  pathname: '/',
  search: '',
  hash: '',
  state: null,
  key: 'default',
}));
const localeStore = createStore<string>(() => 'en-US');

// ---- test controls ----
export function setTestAccess(access: Record<string, unknown>) {
  accessStore.set(access);
}
export function setTestInitialState(state: Record<string, unknown> | undefined) {
  initialStateStore.set(state);
}
export function setTestLocation(location: Partial<StubLocation>) {
  locationStore.set({ ...locationStore.get(), ...location });
}
export function resetUmiStub() {
  accessStore.reset();
  initialStateStore.reset();
  locationStore.reset();
  localeStore.reset();
  history.push.mockClear();
  history.replace.mockClear();
  history.back.mockClear();
}

// ---- Umi exports ----
export const history = {
  push: vi.fn<(to: unknown) => void>(),
  replace: vi.fn<(to: unknown) => void>(),
  back: vi.fn<() => void>(),
};

export function useAccess(): Record<string, unknown> {
  return useSyncExternalStore(accessStore.subscribe, accessStore.get);
}

export function useModel(namespace: string) {
  const initialState = useSyncExternalStore(initialStateStore.subscribe, initialStateStore.get);
  if (namespace !== '@@initialState') {
    throw new Error(`umi-max stub: useModel('${namespace}') is not provided`);
  }
  return {
    initialState,
    loading: false,
    error: undefined,
    refresh: async () => {},
    setInitialState: async (
      next:
        | Record<string, unknown>
        | undefined
        | ((previous: Record<string, unknown> | undefined) => Record<string, unknown> | undefined),
    ) => {
      initialStateStore.set(typeof next === 'function' ? next(initialStateStore.get()) : next);
    },
  };
}

export function useLocation(): StubLocation {
  return useSyncExternalStore(locationStore.subscribe, locationStore.get);
}

export function Link({
  to,
  children,
  ...rest
}: { to: string | { pathname?: string; search?: string }; children?: ReactNode } & Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  'href'
>) {
  const href = typeof to === 'string' ? to : `${to.pathname ?? ''}${to.search ?? ''}`;
  return (
    <a href={href} {...rest}>
      {children}
    </a>
  );
}

export function getLocale(): string {
  return localeStore.get();
}
export function setLocale(locale: string, _realReload?: boolean) {
  localeStore.set(locale);
}
