import { ConfigProvider } from 'antd';
import { type ReactNode, useEffect } from 'react';
import { applyModeToDocument, getModeTokens, toAntdTheme, useThemeMode } from './modes';

/** Puts the theme of the current mode on everything below. Changing the mode re-themes in place. */
export function ThemeRoot({ children }: { children: ReactNode }) {
  const [mode] = useThemeMode();
  useEffect(() => applyModeToDocument(mode), [mode]);
  return <ConfigProvider theme={toAntdTheme(getModeTokens(mode))}>{children}</ConfigProvider>;
}
