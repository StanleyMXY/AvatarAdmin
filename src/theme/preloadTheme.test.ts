import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { preloadThemeScripts } from '../../config/preloadTheme';
import { applyModeToDocument, getModeTokens, THEME_MODES, THEME_STORAGE_KEY } from './modes';

const script = readFileSync('public/preload-theme.js', 'utf8');

// Runs the file as a browser would, against a fresh document element and a given storage.
function run(storage: Pick<Storage, 'getItem'>) {
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('style');
  new Function('localStorage', script).call(window, storage);
  return document.documentElement;
}

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('style');
});

describe('public/preload-theme.js (the background before the app has loaded)', () => {
  for (const mode of THEME_MODES) {
    it(`paints the page background of the saved theme "${mode}" exactly as the app does`, () => {
      const root = run({ getItem: (key) => (key === THEME_STORAGE_KEY ? mode : null) });
      const tokens = getModeTokens(mode);
      expect(root.dataset.theme).toBe(mode);
      expect(root.style.colorScheme).toBe(tokens.isDark ? 'dark' : 'light');
      expect(hex(root.style.backgroundColor)).toBe(tokens.colorBgLayout);
    });
  }

  it('uses the default theme when nothing is saved, when the value is not a theme, and when storage throws', () => {
    for (const storage of [
      { getItem: () => null },
      { getItem: () => 'neon' },
      {
        getItem: () => {
          throw new DOMException('denied', 'SecurityError');
        },
      },
    ]) {
      const root = run(storage);
      expect(root.dataset.theme).toBe('dim');
      expect(hex(root.style.backgroundColor)).toBe(getModeTokens('dim').colorBgLayout);
    }
  });

  it('is loaded by the page from our own origin (an inline script is refused by the policy in the deploy guide)', () => {
    expect(preloadThemeScripts).toEqual([{ src: '/preload-theme.js' }]);
  });
});

describe('changing the theme in the app', () => {
  it('moves the page background along with it, so it does not stay on the first theme', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    applyModeToDocument('light');
    expect(hex(document.documentElement.style.backgroundColor)).toBe(
      getModeTokens('light').colorBgLayout,
    );
    applyModeToDocument('deep');
    expect(hex(document.documentElement.style.backgroundColor)).toBe(
      getModeTokens('deep').colorBgLayout,
    );
    vi.restoreAllMocks();
  });
});

/** A colour as the DOM gives it back (`rgb(...)` in a browser, as written in happy-dom) in upper case hex. */
function hex(color: string): string {
  const rgb = /^rgb\((\d+), (\d+), (\d+)\)$/.exec(color);
  if (!rgb) return color.toUpperCase();
  return `#${rgb
    .slice(1)
    .map((n) => Number(n).toString(16).padStart(2, '0'))
    .join('')}`.toUpperCase();
}
