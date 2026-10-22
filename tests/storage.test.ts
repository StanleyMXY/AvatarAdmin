import { afterEach, describe, expect, it, vi } from 'vitest';

// Code under test guards storage access with try/catch (full quota, blocked storage). These tests
// pin down that every way of making a write throw is really seen by such a guard.

const safeSet = (storage: Storage, key: string, value: string): boolean => {
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

const quota = () => {
  throw new DOMException('quota', 'QuotaExceededError');
};

describe('making storage writes throw', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prototype spy: applies to storages that were already used', () => {
    expect(safeSet(localStorage, 'before', '1')).toBe(true);
    expect(safeSet(sessionStorage, 'before', '1')).toBe(true);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(quota);
    expect(safeSet(localStorage, 'k', 'v')).toBe(false);
    expect(safeSet(sessionStorage, 'k', 'v')).toBe(false);
  });

  it('instance spy: applies to a storage that was already used, and only to that storage', () => {
    expect(safeSet(localStorage, 'before', '1')).toBe(true);
    expect(safeSet(sessionStorage, 'before', '1')).toBe(true);
    vi.spyOn(localStorage, 'setItem').mockImplementation(quota);
    expect(safeSet(localStorage, 'k', 'v')).toBe(false);
    expect(safeSet(sessionStorage, 'k', 'v')).toBe(true);
    expect(localStorage.getItem('k')).toBeNull();
  });

  it('instance spy without an implementation records the call and still stores', () => {
    const spy = vi.spyOn(localStorage, 'setItem');
    expect(safeSet(localStorage, 'k', 'v')).toBe(true);
    expect(spy).toHaveBeenCalledWith('k', 'v');
    expect(localStorage.getItem('k')).toBe('v');
  });

  it('Object.defineProperty on the instance', () => {
    expect(safeSet(localStorage, 'before', '1')).toBe(true);
    Object.defineProperty(localStorage, 'setItem', { value: quota, configurable: true });
    expect(safeSet(localStorage, 'k', 'v')).toBe(false);
    expect(safeSet(sessionStorage, 'k', 'v')).toBe(true);
  });

  it('assigning a function to the instance', () => {
    localStorage.setItem = quota;
    expect(safeSet(localStorage, 'k', 'v')).toBe(false);
    expect(safeSet(sessionStorage, 'k', 'v')).toBe(true);
  });

  it('a throwing getItem and removeItem are seen too', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(quota);
    vi.spyOn(sessionStorage, 'removeItem').mockImplementation(quota);
    expect(() => localStorage.getItem('k')).toThrow();
    expect(() => sessionStorage.removeItem('k')).toThrow();
  });

  it('restoring an instance spy does not leave a stale override behind', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(quota);
    expect(safeSet(localStorage, 'k', 'v')).toBe(false);
    vi.restoreAllMocks();
    expect(safeSet(localStorage, 'k', 'v')).toBe(true);
    expect(localStorage.getItem('k')).toBe('v');
    // a prototype spy installed afterwards still takes effect on the same storage
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(quota);
    expect(safeSet(localStorage, 'k2', 'v')).toBe(false);
  });

  it('keeps ordinary storage behaviour: key access, length, keys, clear', () => {
    localStorage.setItem('a', '1');
    localStorage.b = '2';
    expect(localStorage.getItem('b')).toBe('2');
    expect(localStorage.length).toBe(2);
    expect(Object.keys(localStorage).sort()).toEqual(['a', 'b']);
    expect(localStorage instanceof Storage).toBe(true);
    localStorage.clear();
    expect(localStorage.length).toBe(0);
  });
});
