import { useIntl } from '@umijs/max';
import { Segmented } from 'antd';
import { THEME_MODES, useThemeMode } from '../../theme/modes';

/** Dim, deep or light. The change is applied in place; the page is not reloaded. */
export function ThemeSwitch() {
  const intl = useIntl();
  const [mode, setMode] = useThemeMode();
  return (
    <Segmented
      aria-label={intl.formatMessage({ id: 'pages.theme.label' })}
      size="small"
      value={mode}
      onChange={(value) => setMode(value as (typeof THEME_MODES)[number])}
      options={THEME_MODES.map((value) => ({
        value,
        label: intl.formatMessage({ id: `pages.theme.${value}` }),
      }))}
    />
  );
}
