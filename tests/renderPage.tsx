import { render } from '@testing-library/react';
import { App } from 'antd';
import type { ReactElement } from 'react';
import { IntlProvider } from 'react-intl';
import enUS from '../src/locales/en-US';
import zhCN from '../src/locales/zh-CN';

/** Draws a page the way the app does: language texts, the Ant Design App context. */
export function renderPage(ui: ReactElement, locale: 'en-US' | 'zh-CN' = 'en-US') {
  return render(
    <IntlProvider locale={locale} messages={locale === 'en-US' ? enUS : zhCN} onError={() => {}}>
      <App>{ui}</App>
    </IntlProvider>,
  );
}
