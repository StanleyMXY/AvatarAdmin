import { getLocale, setLocale, useIntl } from '@umijs/max';
import { Select } from 'antd';
import { markPageLanguage } from '../../locales/initLocale';

/** The two interface languages, each named in its own language. */
export function LangSwitch() {
  const intl = useIntl();
  return (
    <Select
      size="small"
      variant="borderless"
      aria-label={intl.formatMessage({ id: 'pages.lang.label' })}
      value={getLocale()}
      onChange={(locale: string) => {
        setLocale(locale, false);
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
