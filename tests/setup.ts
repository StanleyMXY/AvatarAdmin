import '@testing-library/jest-dom/vitest';
import { beforeEach } from 'vitest';

// antd and ProTable read these browser APIs; happy-dom does not provide them.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (!('ResizeObserver' in globalThis)) {
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = ResizeObserverStub;
}

// happy-dom's Storage binds each method onto the instance the first time it is read, so a later
// `vi.spyOn(Storage.prototype, 'setItem')` would silently not apply to a storage that was already
// used. Each test therefore gets fresh storages whose methods look the prototype up at call time:
// spying on the prototype (or on the instance) always takes effect, and no data leaks between tests.
const STORAGE_METHODS = new Set<PropertyKey>(['getItem', 'setItem', 'removeItem', 'clear', 'key']);

function createStorage(): Storage {
  const real = new Storage();
  return new Proxy(real, {
    get(target, property) {
      if (STORAGE_METHODS.has(property)) {
        return (...args: unknown[]) =>
          (Storage.prototype as unknown as Record<PropertyKey, (...a: unknown[]) => unknown>)[
            property
          ].apply(target, args);
      }
      return Reflect.get(target, property);
    },
  });
}

beforeEach(() => {
  for (const name of ['localStorage', 'sessionStorage'] as const) {
    Object.defineProperty(globalThis, name, {
      value: createStorage(),
      configurable: true,
      writable: true,
    });
  }
});
