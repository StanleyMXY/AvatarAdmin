import { theme as antdTheme, type ThemeConfig } from 'antd';
import type { MappingAlgorithm } from 'antd/es/theme/interface';
import { useSyncExternalStore } from 'react';
import { mixHex, pickOnPrimary, readableText } from './contrast';
import { FALL_COLOR, FONT_FAMILY, LAYOUT, PRIMARY, RADIUS, RISE_COLOR } from './tokens';

export type ThemeMode = 'dim' | 'deep' | 'light';

export const THEME_MODES: readonly ThemeMode[] = ['dim', 'deep', 'light'];
export const THEME_STORAGE_KEY = 'avatar-admin.theme-mode';

export type ModeTokens = {
  mode: ThemeMode;
  isDark: boolean;
  colorBgContainer: string;
  colorBgLayout: string;
  colorBgElevated: string;
  colorText: string;
  colorTextSecondary: string;
  colorBorder: string;
  colorPrimary: string;
  colorPrimaryHover: string;
  colorPrimaryActive: string;
  /** Text on a solid primary-coloured element: dark or white, whichever reads better. */
  colorTextOnPrimary: string;
  /**
   * Links and text in the primary colour (a selected menu entry or tab): the primary colour moved
   * just far enough to reach 4.5:1 (WCAG AA) on the container, the page and the raised background.
   * The raw primary colour stays for fills and borders. Hover and press move further from the background.
   */
  colorLink: string;
  colorLinkHover: string;
  colorLinkActive: string;
  /**
   * Hint, helper and placeholder text: Ant Design draws these at 45% and 25% opacity, which is
   * 3.4:1 or less on the light page. Moved just far enough to reach 4.5:1 on every background.
   */
  colorTextHint: string;
  /**
   * A rise and a fall written as text (the change of a figure): the green and the red of the charts
   * moved just far enough to reach 4.5:1 on every background. The chart colours themselves stay.
   */
  colorRiseText: string;
  colorFallText: string;
  fontFamily: string;
};

const BASE: Record<
  ThemeMode,
  Omit<
    ModeTokens,
    | 'mode'
    | 'colorPrimary'
    | 'colorPrimaryHover'
    | 'colorPrimaryActive'
    | 'colorTextOnPrimary'
    | 'colorLink'
    | 'colorLinkHover'
    | 'colorLinkActive'
    | 'colorTextHint'
    | 'colorRiseText'
    | 'colorFallText'
    | 'fontFamily'
  >
> = {
  dim: {
    isDark: true,
    colorBgContainer: '#1C2D3E',
    colorBgLayout: '#15202B',
    colorBgElevated: '#223548',
    colorText: '#E6EDF3',
    colorTextSecondary: '#A5B5C4',
    colorBorder: '#2D4258',
  },
  deep: {
    isDark: true,
    colorBgContainer: '#0F2329',
    colorBgLayout: '#0A171B',
    colorBgElevated: '#143037',
    colorText: '#E3F0F2',
    colorTextSecondary: '#9DB8BD',
    colorBorder: '#1D3A41',
  },
  light: {
    isDark: false,
    colorBgContainer: '#FFFFFF',
    colorBgLayout: '#FAFAFA',
    colorBgElevated: '#FFFFFF',
    colorText: '#1F2933',
    colorTextSecondary: '#52606D',
    colorBorder: '#E4E7EB',
  },
};

/** How far hover and press move the link colour away from the background. */
const LINK_HOVER_SHIFT = 0.18;
const LINK_ACTIVE_SHIFT = 0.32;

const toHex = (color: string) => {
  const rgb = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(color);
  if (!rgb) return color.slice(0, 7).toUpperCase();
  return `#${[rgb[1], rgb[2], rgb[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
};

const tintCache = new Map<boolean, string[]>();

/**
 * The tints of the four status bars (information, success, warning, error: an `Alert`, an inline
 * notice). They come from Ant Design's own algorithm and do not depend on any colour of this theme,
 * so the link colours can be chosen against them before the theme is built.
 */
function statusTints(isDark: boolean): string[] {
  const cached = tintCache.get(isDark);
  if (cached) return cached;
  const resolved = antdTheme.getDesignToken({
    algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
  }) as unknown as Record<string, string>;
  const tints = ['Success', 'Warning', 'Error', 'Info'].map((status) =>
    toHex(resolved[`color${status}Bg`]),
  );
  tintCache.set(isDark, tints);
  return tints;
}

function linkColors(base: (typeof BASE)[ThemeMode], primary: string) {
  // A link also stands in a bar with a tinted background, so it must read on those tints too.
  const backgrounds = [
    base.colorBgContainer,
    base.colorBgLayout,
    base.colorBgElevated,
    ...statusTints(base.isDark),
  ];
  const colorLink = readableText(primary, backgrounds);
  const away = base.isDark ? '#FFFFFF' : '#000000';
  return {
    colorLink,
    colorLinkHover: readableText(mixHex(colorLink, away, LINK_HOVER_SHIFT), backgrounds),
    colorLinkActive: readableText(mixHex(colorLink, away, LINK_ACTIVE_SHIFT), backgrounds),
  };
}

/** `color` moved to 4.5:1 on the container, the page and the raised background of a mode. */
function readableOn(color: string, base: (typeof BASE)[ThemeMode]): string {
  return readableText(color, [base.colorBgContainer, base.colorBgLayout, base.colorBgElevated]);
}

/** The hint text colour: the text colour at the strength Ant Design uses for hints, moved to 4.5:1 where it falls short. */
function hintColor(base: (typeof BASE)[ThemeMode]): string {
  const backgrounds = [base.colorBgContainer, base.colorBgLayout, base.colorBgElevated];
  return readableText(mixHex(base.colorTextSecondary, base.colorBgContainer, 0.15), backgrounds);
}

/** The tokens of a mode. `primary` is the build's primary colour set (the default is the build's own). */
export function getModeTokens(
  mode: ThemeMode,
  primary: { base: string; hover: string; active: string } = PRIMARY,
): ModeTokens {
  return {
    mode,
    ...BASE[mode],
    colorPrimary: primary.base,
    colorPrimaryHover: primary.hover,
    colorPrimaryActive: primary.active,
    colorTextOnPrimary: pickOnPrimary(primary.base),
    ...linkColors(BASE[mode], primary.base),
    colorTextHint: hintColor(BASE[mode]),
    colorRiseText: readableOn(RISE_COLOR, BASE[mode]),
    colorFallText: readableOn(FALL_COLOR, BASE[mode]),
    fontFamily: FONT_FAMILY,
  };
}

/**
 * The dark algorithm moves the primary colour (#0ABAB5 becomes #0CA19D) and works out its own link
 * and primary-text colours; this puts back the seed colours, among them the link colours of
 * `getModeTokens`, which are the ones that reach 4.5:1.
 */
const KEPT_SEEDS = [
  'colorPrimary',
  'colorLink',
  'colorLinkHover',
  'colorLinkActive',
  'colorPrimaryText',
  'colorPrimaryTextHover',
  'colorPrimaryTextActive',
] as const;

const keepPrimary: MappingAlgorithm = (seed, mapToken) => {
  const kept = { ...(mapToken ?? antdTheme.defaultAlgorithm(seed)) };
  for (const name of KEPT_SEEDS) {
    const value = (seed as unknown as Record<string, unknown>)[name];
    if (typeof value === 'string') (kept as Record<string, unknown>)[name] = value;
  }
  return kept;
};

/** The Ant Design theme of a mode. Changing it re-themes the page in place; nothing reloads. */
export function toAntdTheme(tokens: ModeTokens): ThemeConfig {
  return {
    algorithm: tokens.isDark ? [antdTheme.darkAlgorithm, keepPrimary] : antdTheme.defaultAlgorithm,
    token: {
      colorPrimary: tokens.colorPrimary,
      colorPrimaryHover: tokens.colorPrimaryHover,
      colorPrimaryActive: tokens.colorPrimaryActive,
      // Text and links in the primary colour use the shades that reach 4.5:1 (see ModeTokens).
      colorLink: tokens.colorLink,
      colorLinkHover: tokens.colorLinkHover,
      colorLinkActive: tokens.colorLinkActive,
      colorPrimaryText: tokens.colorLink,
      colorPrimaryTextHover: tokens.colorLinkHover,
      colorPrimaryTextActive: tokens.colorLinkActive,
      colorTextTertiary: tokens.colorTextHint,
      colorTextPlaceholder: tokens.colorTextHint,
      colorBgContainer: tokens.colorBgContainer,
      colorBgLayout: tokens.colorBgLayout,
      colorBgElevated: tokens.colorBgElevated,
      colorText: tokens.colorText,
      colorTextSecondary: tokens.colorTextSecondary,
      colorBorder: tokens.colorBorder,
      borderRadius: RADIUS.base,
      borderRadiusLG: RADIUS.large,
      borderRadiusSM: RADIUS.small,
      fontSize: LAYOUT.fontSize,
      fontFamily: tokens.fontFamily,
    },
    components: {
      // Solid primary buttons carry dark text: white on the primary colour is only 2.4:1.
      Button: { primaryColor: tokens.colorTextOnPrimary },
      // The same for a selected radio button in the solid style.
      Radio: { buttonSolidCheckedColor: tokens.colorTextOnPrimary },
      Menu: {
        itemSelectedColor: tokens.colorLink,
        subMenuItemSelectedColor: tokens.colorLink,
        horizontalItemSelectedColor: tokens.colorLink,
      },
      Pagination: {
        itemActiveColor: tokens.colorLink,
        itemActiveColorHover: tokens.colorLinkHover,
      },
      Tabs: {
        itemSelectedColor: tokens.colorLink,
        itemHoverColor: tokens.colorLinkHover,
        itemActiveColor: tokens.colorLinkActive,
      },
    },
  };
}

// ---- the mode in use, shared by every component that shows or changes it ----
const isMode = (value: unknown): value is ThemeMode =>
  typeof value === 'string' && (THEME_MODES as readonly string[]).includes(value);

let current: ThemeMode | undefined;
const listeners = new Set<() => void>();

function readStored(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (isMode(stored)) return stored;
  } catch {
    // storage is not available: the default applies
  }
  return 'dim';
}

const getMode = (): ThemeMode => {
  if (current === undefined) current = readStored();
  return current;
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export type StatusTextColors = {
  success: string;
  warning: string;
  error: string;
  info: string;
  /** The red text of a button (link, text, outlined) when hovered and when pressed. */
  errorHover: string;
  errorActive: string;
};

const statusCache = new Map<ThemeMode, StatusTextColors>();

/**
 * The text colours of the four statuses (a "success" tag, red "danger" text ...). Ant Design draws
 * them in its status colours, which are 1.8:1 to 4.0:1 on the tag's own tint and on the page in
 * the themes; these are those colours moved just far enough to reach 4.5:1 on the tint of their
 * tag and on the container, the page and the raised background. Fills and borders keep the
 * status colours.
 */
export function getStatusTextColors(mode: ThemeMode): StatusTextColors {
  const cached = statusCache.get(mode);
  if (cached) return cached;
  const tokens = getModeTokens(mode);
  const resolved = antdTheme.getDesignToken(toAntdTheme(tokens)) as unknown as Record<
    string,
    string
  >;
  const readable = (status: 'Success' | 'Warning' | 'Error' | 'Info') =>
    readableText(toHex(resolved[`color${status}`]), [
      toHex(resolved[`color${status}Bg`]),
      tokens.colorBgContainer,
      tokens.colorBgLayout,
      tokens.colorBgElevated,
    ]);
  const error = readable('Error');
  const errorBackgrounds = [
    toHex(resolved.colorErrorBg),
    tokens.colorBgContainer,
    tokens.colorBgLayout,
    tokens.colorBgElevated,
  ];
  const away = tokens.isDark ? '#FFFFFF' : '#000000';
  const colors = {
    success: readable('Success'),
    warning: readable('Warning'),
    error,
    info: readable('Info'),
    errorHover: readableText(mixHex(error, away, LINK_HOVER_SHIFT), errorBackgrounds),
    errorActive: readableText(mixHex(error, away, LINK_ACTIVE_SHIFT), errorBackgrounds),
  };
  statusCache.set(mode, colors);
  return colors;
}

export type ErrorSolidColors = {
  /** The fill of a solid red button at rest, on hover and while pressed. */
  rest: string;
  hover: string;
  active: string;
};

const solidCache = new Map<ThemeMode, ErrorSolidColors>();

/**
 * The fill of a solid red button (a delete or leave confirmation) with the white text Ant Design
 * puts on it. Ant Design fills it with its error red, which carries white at 3.3:1 (light) or
 * 4.2:1 (the dark themes), and lightens it on hover, which is 2.6:1 and 3.1:1. The rest colour is the
 * error red moved toward black just far enough to reach 4.5:1 with the text; hover and press go
 * further toward black (as the links do), so they stay readable and still show.
 */
export function getErrorSolidColors(mode: ThemeMode): ErrorSolidColors {
  const cached = solidCache.get(mode);
  if (cached) return cached;
  const resolved = antdTheme.getDesignToken(toAntdTheme(getModeTokens(mode))) as unknown as Record<
    string,
    string
  >;
  const text = toHex(resolved.colorTextLightSolid);
  // The text is light, so the fill moves toward black (readableText moves toward the darker end
  // when the background list is light: the text is the "background" of this check).
  const rest = readableText(toHex(resolved.colorError), [text]);
  const colors = {
    rest,
    hover: mixHex(rest, '#000000', LINK_HOVER_SHIFT),
    active: mixHex(rest, '#000000', LINK_ACTIVE_SHIFT),
  };
  solidCache.set(mode, colors);
  return colors;
}

/** The preset colours a tag can be given (`<Tag color="green">`). */
export const PRESET_TAG_COLORS = [
  'blue',
  'purple',
  'cyan',
  'green',
  'magenta',
  'pink',
  'red',
  'orange',
  'yellow',
  'volcano',
  'geekblue',
  'lime',
  'gold',
] as const;
export type PresetTagColor = (typeof PRESET_TAG_COLORS)[number];

const presetCache = new Map<ThemeMode, Record<PresetTagColor, string>>();

/**
 * The text colour of each preset colour tag. Ant Design writes the seventh shade of the colour on
 * its first shade, which is 2.1:1 to 3.4:1 for green, orange, gold, yellow, lime and cyan on the
 * light page; these are those colours moved just far enough to reach 4.5:1 on the tint of the tag
 * itself and on the container, the page and the raised background.
 */
export function getPresetTagColors(mode: ThemeMode): Record<PresetTagColor, string> {
  const cached = presetCache.get(mode);
  if (cached) return cached;
  const tokens = getModeTokens(mode);
  const resolved = antdTheme.getDesignToken(toAntdTheme(tokens)) as unknown as Record<
    string,
    string
  >;
  const colors = Object.fromEntries(
    PRESET_TAG_COLORS.map((name) => [
      name,
      readableText(toHex(resolved[`${name}7`]), [
        toHex(resolved[`${name}1`]),
        tokens.colorBgContainer,
        tokens.colorBgLayout,
        tokens.colorBgElevated,
      ]),
    ]),
  ) as Record<PresetTagColor, string>;
  presetCache.set(mode, colors);
  return colors;
}

/** The grey Ant Design lays under inline `code` is 10% of rgb(150,150,150); 20% leaves a margin. */
const CODE_TINT = { color: '#969696', amount: 0.2 };

/**
 * The text colour of inline `code`. Inside secondary text it is a grey that is 4.4:1 on the grey
 * tint under it; this is the secondary text colour moved to 4.5:1 on that tint over every background.
 */
export function getCodeTextColor(mode: ThemeMode): string {
  const tokens = getModeTokens(mode);
  return readableText(
    tokens.colorTextSecondary,
    [tokens.colorBgContainer, tokens.colorBgLayout, tokens.colorBgElevated].map((bg) =>
      mixHex(bg, CODE_TINT.color, CODE_TINT.amount),
    ),
  );
}

/** Marks the document with the mode, for CSS and for the browser's own controls. */
export function applyModeToDocument(mode: ThemeMode): void {
  document.documentElement.dataset.theme = mode;
  document.documentElement.style.colorScheme = BASE[mode].isDark ? 'dark' : 'light';
  // The page behind the app (before it is drawn, and when scrolled past its end) is the layout colour.
  document.documentElement.style.backgroundColor = BASE[mode].colorBgLayout;
  // The colours src/global.css uses for what Ant Design draws with the raw primary colour.
  const tokens = getModeTokens(mode);
  const style = document.documentElement.style;
  style.setProperty('--avatar-link', tokens.colorLink);
  style.setProperty('--avatar-link-hover', tokens.colorLinkHover);
  style.setProperty('--avatar-link-active', tokens.colorLinkActive);
  style.setProperty('--avatar-on-primary', tokens.colorTextOnPrimary);
  const status = getStatusTextColors(mode);
  style.setProperty('--avatar-success-text', status.success);
  style.setProperty('--avatar-warning-text', status.warning);
  style.setProperty('--avatar-error-text', status.error);
  style.setProperty('--avatar-info-text', status.info);
  style.setProperty('--avatar-error-text-hover', status.errorHover);
  style.setProperty('--avatar-error-text-active', status.errorActive);
  const solid = getErrorSolidColors(mode);
  style.setProperty('--avatar-error-solid', solid.rest);
  style.setProperty('--avatar-error-solid-hover', solid.hover);
  style.setProperty('--avatar-error-solid-active', solid.active);
  const presets = getPresetTagColors(mode);
  for (const name of PRESET_TAG_COLORS)
    style.setProperty(`--avatar-tag-${name}-text`, presets[name]);
  style.setProperty('--avatar-code-text', getCodeTextColor(mode));
}

export function setThemeMode(mode: ThemeMode): void {
  if (!isMode(mode)) return;
  current = mode;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // the choice then lasts until the page is closed
  }
  applyModeToDocument(mode);
  for (const listener of listeners) listener();
}

export function useThemeMode(): [ThemeMode, (mode: ThemeMode) => void] {
  const mode = useSyncExternalStore(subscribe, getMode, getMode);
  return [mode, setThemeMode];
}

/** The tokens of the mode in use (they change with it). */
export function useModeTokens(): ModeTokens {
  const [mode] = useThemeMode();
  return getModeTokens(mode);
}

/** Forgets the mode held in memory, so the next read goes to localStorage again (tests). */
export function resetThemeModeForTests(): void {
  current = undefined;
  for (const listener of listeners) listener();
}
