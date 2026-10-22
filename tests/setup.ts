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
// used. Each test therefore gets fresh storages (no data leaks between tests) in a thin proxy:
//   - a method that was defined or assigned on the storage itself (`vi.spyOn(localStorage,
//     'setItem')`, `Object.defineProperty(localStorage, ...)`, `localStorage.setItem = fn`) is
//     remembered and used;
//   - otherwise the method is looked up on `Storage.prototype` at call time, so a spy on the
//     prototype takes effect even if the storage was used before.
const STORAGE_METHODS = new Set<PropertyKey>(['getItem', 'setItem', 'removeItem', 'clear', 'key']);

type AnyFunction = (...args: unknown[]) => unknown;

function createStorage(): Storage {
  const real = new Storage();
  const overrides = new Map<PropertyKey, PropertyDescriptor>();
  const prototypeMethods = Storage.prototype as unknown as Record<PropertyKey, AnyFunction>;

  return new Proxy(real, {
    get(target, property, receiver) {
      if (STORAGE_METHODS.has(property)) {
        const override = overrides.get(property);
        if (override) return override.get ? override.get.call(receiver) : override.value;
        return (...args: unknown[]) => prototypeMethods[property].apply(receiver, args);
      }
      return Reflect.get(target, property);
    },
    set(target, property, value) {
      if (STORAGE_METHODS.has(property)) {
        overrides.set(property, { value, writable: true, enumerable: false, configurable: true });
        return true;
      }
      return Reflect.set(target, property, value);
    },
    defineProperty(target, property, descriptor) {
      if (STORAGE_METHODS.has(property)) {
        overrides.set(property, { ...descriptor });
        return true;
      }
      return Reflect.defineProperty(target, property, descriptor);
    },
    deleteProperty(target, property) {
      if (STORAGE_METHODS.has(property)) {
        overrides.delete(property);
        return true;
      }
      return Reflect.deleteProperty(target, property);
    },
    getOwnPropertyDescriptor(target, property) {
      if (STORAGE_METHODS.has(property)) return overrides.get(property);
      return Reflect.getOwnPropertyDescriptor(target, property);
    },
    has(target, property) {
      return STORAGE_METHODS.has(property) || Reflect.has(target, property);
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
