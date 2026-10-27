import { getModeTokens, type ThemeMode } from './modes';
import { CHART_PALETTE, FALL_COLOR, RISE_COLOR } from './tokens';

export type ChartThemeConfig = {
  mode: ThemeMode;
  /** The theme name of the chart library (G2): its dark or light base. */
  g2Theme: 'classic' | 'classicDark';
  palette: string[];
  rise: string;
  fall: string;
  textColor: string;
  gridColor: string;
  background: string;
};

/**
 * What a chart needs to match the mode. A new object comes back each time, so a chart that takes it
 * as a property is drawn again when the mode changes.
 */
export function getChartTheme(mode: ThemeMode): ChartThemeConfig {
  const tokens = getModeTokens(mode);
  return {
    mode,
    g2Theme: tokens.isDark ? 'classicDark' : 'classic',
    palette: [...CHART_PALETTE],
    rise: RISE_COLOR,
    fall: FALL_COLOR,
    textColor: tokens.colorTextSecondary,
    gridColor: tokens.colorBorder,
    background: tokens.colorBgContainer,
  };
}
