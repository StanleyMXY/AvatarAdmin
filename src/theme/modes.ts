import { theme as antdTheme, type ThemeConfig } from 'antd';
import type { MappingAlgorithm } from 'antd/es/theme/interface';
import { useSyncExternalStore } from 'react';
import { mixHex, pickOnPrimary, readableText } from './contrast';
import { FONT_FAMILY, LAYOUT, PRIMARY, RADIUS } from './tokens';

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

function linkColors(base: (typeof BASE)[ThemeMode], primary: string) {
  const backgrounds = [base.colorBgContainer, base.colorBgLayout, base.colorBgElevated];
  const colorLink = readableText(primary, backgrounds);
  const away = base.isDark ? '#FFFFFF' : '#000000';
  return {
    colorLink,
    colorLinkHover: readableText(mixHex(colorLink, away, LINK_HOVER_SHIFT), backgrounds),
    colorLinkActive: readableText(mixHex(colorLink, away, LINK_ACTIVE_SHIFT), backgrounds),
  };
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

/** Marks the document with the mode, for CSS and for the browser's own controls. */
export function applyModeToDocument(mode: ThemeMode): void {
  document.documentElement.dataset.theme = mode;
  document.documentElement.style.colorScheme = BASE[mode].isDark ? 'dark' : 'light';
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

/** Forgets the mode held in memory, so the next read goes to localStorage again (tests). */
export function resetThemeModeForTests(): void {
  current = undefined;
  for (const listener of listeners) listener();
}
