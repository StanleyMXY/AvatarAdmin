import { readFileSync } from 'node:fs';
import { act, renderHook } from '@testing-library/react';
import { theme as antdTheme } from 'antd';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { contrastRatio, pickOnPrimary } from './contrast';
import {
  applyModeToDocument,
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

  it.each(THEME_MODES)('renders the spec primary colours in %s mode', (mode) => {
    const cfg = toAntdTheme(getModeTokens(mode));
    const resolved = antdTheme.getDesignToken(cfg);
    expect(resolved.colorPrimary.toUpperCase()).toBe('#0ABAB5');
    expect(resolved.colorPrimaryHover.toUpperCase()).toBe('#3DCBC7');
    expect(resolved.colorPrimaryActive.toUpperCase()).toBe('#089A96');
    expect(
      contrastRatio(getModeTokens(mode).colorTextOnPrimary, resolved.colorPrimary),
    ).toBeGreaterThanOrEqual(4.5);
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

// ---- the colours of links and of primary-coloured text ----
const TEXT_BACKGROUNDS = (t: ReturnType<typeof getModeTokens>) => [
  t.colorBgContainer,
  t.colorBgLayout,
  t.colorBgElevated,
];

const PRIMARIES = [
  { base: '#0ABAB5', hover: '#3DCBC7', active: '#089A96' },
  { base: '#FFD700', hover: '#FFE24D', active: '#CCAC00' },
  { base: '#00FFFF', hover: '#66FFFF', active: '#00CCCC' },
  { base: '#7C3AED', hover: '#9061F9', active: '#6D28D9' },
  { base: '#FFFFFF', hover: '#FFFFFF', active: '#EEEEEE' },
  { base: '#000000', hover: '#222222', active: '#000000' },
];

describe.each(THEME_MODES)('secondary, hint and placeholder text in %s mode', (mode: ThemeMode) => {
  const resolved = () =>
    antdTheme.getDesignToken(toAntdTheme(getModeTokens(mode))) as unknown as Record<string, string>;

  it.each([
    'colorTextSecondary',
    'colorTextDescription',
    'colorTextTertiary',
    'colorTextPlaceholder',
  ])('%s is at least 4.5:1 on the container, the page and the raised background', (name) => {
    const tokens = getModeTokens(mode);
    const value = resolved()[name];
    expect(value).toMatch(/^#[0-9a-f]{6}$/i);
    for (const bg of TEXT_BACKGROUNDS(tokens)) {
      expect(contrastRatio(value, bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('hint text is still weaker than the body text', () => {
    const tokens = getModeTokens(mode);
    const hint = resolved().colorTextDescription;
    const [bg] = TEXT_BACKGROUNDS(tokens);
    expect(contrastRatio(hint, bg)).toBeLessThan(contrastRatio(tokens.colorText, bg));
  });
});

describe.each(THEME_MODES)('solid primary fills in %s mode', (mode: ThemeMode) => {
  it('a selected solid radio button carries the same text as a primary button, not white', () => {
    const tokens = getModeTokens(mode);
    const components = toAntdTheme(tokens).components as Record<string, Record<string, string>>;
    expect(components.Radio.buttonSolidCheckedColor).toBe(tokens.colorTextOnPrimary);
    expect(contrastRatio(tokens.colorTextOnPrimary, tokens.colorPrimary)).toBeGreaterThanOrEqual(
      4.5,
    );
  });

  it('puts the colours the global style sheet uses on the document: link, hover, press, text on primary', () => {
    const tokens = getModeTokens(mode);
    applyModeToDocument(mode);
    const style = document.documentElement.style;
    expect(style.getPropertyValue('--avatar-link')).toBe(tokens.colorLink);
    expect(style.getPropertyValue('--avatar-link-hover')).toBe(tokens.colorLinkHover);
    expect(style.getPropertyValue('--avatar-link-active')).toBe(tokens.colorLinkActive);
    expect(style.getPropertyValue('--avatar-on-primary')).toBe(tokens.colorTextOnPrimary);
  });
});

describe('src/global.css (what Ant Design draws with the raw primary colour, set right)', () => {
  const css = readFileSync('src/global.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = css
    .split('}')
    .map((rule) => rule.split('{'))
    .filter((parts) => parts.length === 2)
    .map(([selectors, body]) => ({
      selectors: selectors
        .split(',')
        .map((selector) => selector.replace(/\s+/g, ' ').trim())
        .filter(Boolean),
      body: body.trim(),
    }));
  /** The declarations of the rule that has a selector ending in `ending`. */
  const bodyOf = (ending: string) =>
    rules.find((rule) => rule.selectors.some((selector) => selector.endsWith(ending)))?.body;

  it('moves the text of the selected and hovered round radio buttons to the readable link colours, not on the solid style', () => {
    const base = '.ant-radio-group:not(.ant-radio-group-solid) .ant-radio-button-wrapper';
    const checked = `${base}-checked:not(.ant-radio-button-wrapper-disabled)`;
    expect(bodyOf(checked)).toBe('color: var(--avatar-link);');
    expect(bodyOf(`${base}:not(.ant-radio-button-wrapper-disabled):hover`)).toBe(
      'color: var(--avatar-link);',
    );
    expect(bodyOf(`${checked}:hover`)).toBe('color: var(--avatar-link-hover);');
    expect(bodyOf(`${checked}:active`)).toBe('color: var(--avatar-link-active);');
  });

  it('gives the selected day, and the ends of a selected range, of a date picker the text of a primary button', () => {
    for (const state of ['selected', 'range-start', 'range-end']) {
      expect(
        bodyOf(
          `.ant-picker-cell-in-view.ant-picker-cell-${state}:not(.ant-picker-cell-disabled) .ant-picker-cell-inner`,
        ),
      ).toBe('color: var(--avatar-on-primary);');
    }
  });

  it('gives the fold and unfold link of a search form the link colour', () => {
    expect(bodyOf('.ant-pro-query-filter-collapse-button')).toBe('color: var(--avatar-link);');
  });

  it('beats the rules Ant Design injects at run time: every selector starts with html[data-theme]', () => {
    expect(rules.length).toBeGreaterThanOrEqual(5);
    for (const rule of rules)
      for (const selector of rule.selectors)
        expect(selector.startsWith('html[data-theme] ')).toBe(true);
  });
});

describe.each(THEME_MODES)('links and primary-coloured text in %s mode', (mode: ThemeMode) => {
  const resolved = (tokens = getModeTokens(mode)) =>
    antdTheme.getDesignToken(toAntdTheme(tokens)) as unknown as Record<string, string>;
  const NAMES = [
    'colorLink',
    'colorLinkHover',
    'colorLinkActive',
    'colorPrimaryText',
    'colorPrimaryTextHover',
    'colorPrimaryTextActive',
  ];

  it.each(NAMES)(
    '%s is at least 4.5:1 on the container, the page and the raised background',
    (name) => {
      const tokens = getModeTokens(mode);
      const value = resolved(tokens)[name];
      expect(value).toMatch(/^#[0-9a-f]{6}$/i);
      for (const bg of TEXT_BACKGROUNDS(tokens)) {
        expect(contrastRatio(value, bg)).toBeGreaterThanOrEqual(4.5);
      }
    },
  );

  it('the dedicated colours are in the mode tokens and are what the theme hands to Ant Design', () => {
    const tokens = getModeTokens(mode);
    const theme = toAntdTheme(tokens).token as Record<string, string>;
    expect([theme.colorLink, theme.colorLinkHover, theme.colorLinkActive]).toEqual([
      tokens.colorLink,
      tokens.colorLinkHover,
      tokens.colorLinkActive,
    ]);
    expect([
      theme.colorPrimaryText,
      theme.colorPrimaryTextHover,
      theme.colorPrimaryTextActive,
    ]).toEqual([tokens.colorLink, tokens.colorLinkHover, tokens.colorLinkActive]);
  });

  it('the selected item of a menu, a tab and the current page number use the dedicated colour, not the raw primary', () => {
    const tokens = getModeTokens(mode);
    const components = toAntdTheme(tokens).components as Record<string, Record<string, string>>;
    expect(components.Menu.itemSelectedColor).toBe(tokens.colorLink);
    expect(components.Menu.subMenuItemSelectedColor).toBe(tokens.colorLink);
    expect(components.Menu.horizontalItemSelectedColor).toBe(tokens.colorLink);
    expect(components.Tabs.itemSelectedColor).toBe(tokens.colorLink);
    expect(components.Tabs.itemHoverColor).toBe(tokens.colorLinkHover);
    expect(components.Tabs.itemActiveColor).toBe(tokens.colorLinkActive);
    expect(components.Pagination.itemActiveColor).toBe(tokens.colorLink);
    expect(components.Pagination.itemActiveColorHover).toBe(tokens.colorLinkHover);
  });

  it('all three link colours stay readable whatever primary colour the build sets', () => {
    for (const primary of PRIMARIES) {
      const tokens = getModeTokens(mode, primary);
      for (const name of ['colorLink', 'colorLinkHover', 'colorLinkActive'] as const) {
        for (const bg of TEXT_BACKGROUNDS(tokens)) {
          expect(contrastRatio(tokens[name], bg)).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });

  it('a primary colour that is already readable is kept as the link colour', () => {
    const tokens = getModeTokens(mode);
    if (TEXT_BACKGROUNDS(tokens).every((bg) => contrastRatio(tokens.colorPrimary, bg) >= 4.5)) {
      expect(tokens.colorLink).toBe(tokens.colorPrimary);
    } else {
      expect(tokens.colorLink).not.toBe(tokens.colorPrimary);
    }
  });

  it('moves away from the background on hover and press (darker on light, lighter on dark)', () => {
    const tokens = getModeTokens(mode);
    const [bg] = TEXT_BACKGROUNDS(tokens);
    expect(contrastRatio(tokens.colorLinkHover, bg)).toBeGreaterThan(
      contrastRatio(tokens.colorLink, bg),
    );
    expect(contrastRatio(tokens.colorLinkActive, bg)).toBeGreaterThan(
      contrastRatio(tokens.colorLinkHover, bg),
    );
  });

  it('keeps the primary colour itself for fills and borders', () => {
    const tokens = getModeTokens(mode);
    expect((toAntdTheme(tokens).token as Record<string, string>).colorPrimary).toBe(
      tokens.colorPrimary,
    );
  });
});
