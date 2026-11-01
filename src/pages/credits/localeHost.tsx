import { act, render } from '@testing-library/react';
import { App } from 'antd';
import { type ReactElement, useEffect, useState } from 'react';
import { IntlProvider } from 'react-intl';
import enUS from '../../locales/en-US';
import zhCN from '../../locales/zh-CN';

type Locale = 'en-US' | 'zh-CN';

function Host({
  ui,
  expose,
}: {
  ui: ReactElement;
  expose: (setLocale: (locale: Locale) => void) => void;
}) {
  const [locale, setLocale] = useState<Locale>('en-US');
  useEffect(() => expose(setLocale), [expose]);
  return (
    <IntlProvider locale={locale} messages={locale === 'en-US' ? enUS : zhCN} onError={() => {}}>
      <App>{ui}</App>
    </IntlProvider>
  );
}

/** For page tests: draws a page the way `renderPage` does, and lets the test switch the language while it stays mounted. */
export function renderWithLocaleSwitch(ui: ReactElement) {
  let set: (locale: Locale) => void = () => {};
  const view = render(
    <Host
      ui={ui}
      expose={(setLocale) => {
        set = setLocale;
      }}
    />,
  );
  return {
    ...view,
    switchTo: (locale: Locale) =>
      act(() => {
        set(locale);
      }),
  };
}
