import { getLocale, setLocale, useIntl } from '@umijs/max';
import { Select } from 'antd';
import { rememberLocale } from '../../locales/activeLocale';
import { markPageLanguage } from '../../locales/initLocale';
import type { AppLocale } from '../../utils/resolveLocale';

/** The two interface languages, each named in its own language. */
export function LangSwitch() {
  const intl = useIntl();
  return (
    <Select
      size="small"
      variant="borderless"
      aria-label={intl.formatMessage({ id: 'pages.lang.label' })}
      value={getLocale()}
      onChange={(locale: AppLocale) => {
        // Umi first (it compares with the language in use), then the app's own record of it.
        setLocale(locale, false);
        rememberLocale(locale);
        markPageLanguage(locale);
      }}
      options={[
        { value: 'zh-CN', label: intl.formatMessage({ id: 'pages.lang.zhCN' }) },
        { value: 'en-US', label: intl.formatMessage({ id: 'pages.lang.enUS' }) },
      ]}
      style={{ minWidth: 110 }}
    />
  );
}
