import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { contrastRatio, pickOnPrimary } from './contrast';
import {
  getModeTokens,
  resetThemeModeForTests,
  THEME_MODES,
  THEME_STORAGE_KEY,
  type ThemeMode,
  toAntdTheme,
  useThemeMode,
} from './modes';
import { LAYOUT, RADIUS } from './tokens';

beforeEach(() => resetThemeModeForTests());
afterEach(() => vi.restoreAllMocks());

describe('getModeTokens: the values of spec section 7', () => {
  it('dim: container #1C2D3E on background #15202B', () => {
    expect(getModeTokens('dim')).toMatchObject({
      colorBgContainer: '#1C2D3E',
      colorBgLayout: '#15202B',
      isDark: true,
    });
  });
  it('deep: container #0F2329 on background #0A171B', () => {
    expect(getModeTokens('deep')).toMatchObject({
      colorBgContainer: '#0F2329',
      colorBgLayout: '#0A171B',
      isDark: true,
    });
  });
  it('light: container #FFFFFF on background #FAFAFA', () => {
    expect(getModeTokens('light')).toMatchObject({
      colorBgContainer: '#FFFFFF',
      colorBgLayout: '#FAFAFA',
      isDark: false,
    });
  });
  it('has exactly the three modes, dim first', () => {
    expect(THEME_MODES).toEqual(['dim', 'deep', 'light']);
  });
});

describe.each(THEME_MODES)('contrast in %s mode', (mode: ThemeMode) => {
  const tokens = getModeTokens(mode);
  it('body text on the background and on the container is at least 4.5:1', () => {
    expect(contrastRatio(tokens.colorText, tokens.colorBgLayout)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(tokens.colorText, tokens.colorBgContainer)).toBeGreaterThanOrEqual(4.5);
  });
  it('secondary text on the container is at least 4.5:1 too', () => {
    expect(
      contrastRatio(tokens.colorTextSecondary, tokens.colorBgContainer),
    ).toBeGreaterThanOrEqual(4.5);
  });
  it('the text on a solid primary element is pickOnPrimary, at least 4.5:1 on the primary colour and on its hover and active colours', () => {
    expect(tokens.colorTextOnPrimary).toBe(pickOnPrimary(tokens.colorPrimary));
    for (const bg of [tokens.colorPrimary, tokens.colorPrimaryHover, tokens.colorPrimaryActive]) {
      expect(contrastRatio(pickOnPrimary(bg), bg)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrastRatio(tokens.colorTextOnPrimary, tokens.colorPrimary)).toBeGreaterThanOrEqual(
      4.5,
    );
  });
});

describe('the layout and shape tokens', () => {
  it('sider 240, header 56, content padding 24, radius 12/16/8, font size 14', () => {
    expect(LAYOUT).toMatchObject({
      siderWidth: 240,
      headerHeight: 56,
      contentPadding: 24,
      fontSize: 14,
    });
    expect(RADIUS).toEqual({ base: 12, large: 16, small: 8 });
  });

  it('the primary colours are the build variables (spec defaults here)', () => {
    expect(getModeTokens('dim')).toMatchObject({
      colorPrimary: '#0ABAB5',
      colorPrimaryHover: '#3DCBC7',
      colorPrimaryActive: '#089A96',
    });
  });

  it('uses the system font stack and no external font', () => {
    expect(getModeTokens('dim').fontFamily).toMatch(/system-ui|-apple-system|Segoe UI/);
    expect(getModeTokens('dim').fontFamily).not.toMatch(/https?:|url\(/);
  });
});

describe('toAntdTheme', () => {
  it('uses the dark algorithm in dim and deep and the default one in light', () => {
    const dark = toAntdTheme(getModeTokens('dim'));
    const deep = toAntdTheme(getModeTokens('deep'));
    const light = toAntdTheme(getModeTokens('light'));
    expect(String(dark.algorithm)).toBe(String(deep.algorithm));
    expect(String(dark.algorithm)).not.toBe(String(light.algorithm));
  });

  it('carries the container, layout, primary and radius tokens', () => {
    const theme = toAntdTheme(getModeTokens('deep'));
    expect(theme.token).toMatchObject({
      colorPrimary: '#0ABAB5',
      colorBgContainer: '#0F2329',
      colorBgLayout: '#0A171B',
      borderRadius: 12,
      fontSize: 14,
    });
  });

  it('puts the solid-primary text colour on the primary button', () => {
    const theme = toAntdTheme(getModeTokens('dim'));
    expect(theme.components?.Button).toMatchObject({ primaryColor: '#06201F' });
  });
});

describe('useThemeMode', () => {
  it('starts in dim', () => {
    const { result } = renderHook(() => useThemeMode());
    expect(result.current[0]).toBe('dim');
  });

  it('changes the mode and keeps it in localStorage', () => {
    const { result } = renderHook(() => useThemeMode());
    act(() => result.current[1]('light'));
    expect(result.current[0]).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('reads the saved mode on the next start', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'deep');
    resetThemeModeForTests();
    const { result } = renderHook(() => useThemeMode());
    expect(result.current[0]).toBe('deep');
  });

  it('ignores a saved value that is not a mode', () => {
    for (const bad of ['', 'blue', 'LIGHT', 'null']) {
      localStorage.setItem(THEME_STORAGE_KEY, bad);
      resetThemeModeForTests();
      expect(renderHook(() => useThemeMode()).result.current[0]).toBe('dim');
    }
  });

  it('keeps two components in step', () => {
    const a = renderHook(() => useThemeMode());
    const b = renderHook(() => useThemeMode());
    act(() => a.result.current[1]('deep'));
    expect(b.result.current[0]).toBe('deep');
  });

  it('changes the mode without a reload and sets the data-theme attribute on <html>', () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    const { result } = renderHook(() => useThemeMode());
    act(() => result.current[1]('light'));
    expect(reload).not.toHaveBeenCalled();
    expect(document.documentElement.dataset.theme).toBe('light');
    vi.unstubAllGlobals();
  });

  it('works when localStorage cannot be read or written', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    resetThemeModeForTests();
    const { result } = renderHook(() => useThemeMode());
    expect(result.current[0]).toBe('dim');
    expect(() => act(() => result.current[1]('light'))).not.toThrow();
    expect(result.current[0]).toBe('light');
  });

  it('refuses a mode that does not exist', () => {
    const { result } = renderHook(() => useThemeMode());
    act(() => result.current[1]('blue' as never));
    expect(result.current[0]).toBe('dim');
  });
});
