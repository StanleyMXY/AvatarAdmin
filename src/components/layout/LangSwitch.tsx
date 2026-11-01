import { getLocale, useIntl } from '@umijs/max';
import { Select } from 'antd';
import { switchLocale } from '../../locales/initLocale';
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
      onChange={(locale: AppLocale) => switchLocale(locale)}
      options={[
        { value: 'zh-CN', label: intl.formatMessage({ id: 'pages.lang.zhCN' }) },
        { value: 'en-US', label: intl.formatMessage({ id: 'pages.lang.enUS' }) },
      ]}
      style={{ minWidth: 110 }}
    />
  );
}
