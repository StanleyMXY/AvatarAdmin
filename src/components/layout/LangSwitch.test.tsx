import { fireEvent, render, screen } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { IntlProvider } from 'react-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { currentLocale, resetActiveLocaleForTests } from '../../locales/activeLocale';
import { LangSwitch } from './LangSwitch';

// A model of Umi's locale functions as the plugin generates them (src/.umi/plugin-locale/
// localeExports.ts): `setLocale` reads `window.localStorage` before it looks at the setting that
// says whether it may use it, so a browser that refuses site data makes it throw before anything
// has changed; `addLocale` only announces a language that is already the one in use.
const umi = vi.hoisted(() => {
  const listeners = new Set<(locale: string) => void>();
  let inUse = () => 'en-US';
  const useLocalStorage = { current: false }; // config/localeConfig.ts
  return {
    listeners,
    useAppLanguage(read: () => string) {
      inUse = read;
    },
    getLocale: () => inUse(),
    setLocale(lang: string) {
      if (inUse() !== lang) {
        if (
          navigator.cookieEnabled &&
          typeof window.localStorage !== 'undefined' &&
          useLocalStorage.current
        ) {
          window.localStorage.setItem('umi_locale', lang);
        }
        for (const listener of listeners) listener(lang);
      }
    },
    addLocale(name: string) {
      if (name === inUse()) for (const listener of listeners) listener(name);
    },
  };
});

vi.mock('@umijs/max', async () => {
  const stub = await import('../../../tests/stubs/umi-max');
  return {
    ...stub,
    getLocale: umi.getLocale,
    setLocale: umi.setLocale,
    addLocale: umi.addLocale,
  };
});

const messages = {
  'pages.lang.zhCN': '简体中文',
  'pages.lang.enUS': 'English',
  'pages.lang.label': 'Language',
};

// What Umi's container does: draw the tree again when the language is announced.
function Container() {
  const [, redraw] = useState(0);
  useEffect(() => {
    const listener = () => redraw((n) => n + 1);
    umi.listeners.add(listener);
    return () => {
      umi.listeners.delete(listener);
    };
  }, []);
  return (
    <IntlProvider locale="en-US" messages={messages} onError={() => {}}>
      <LangSwitch />
    </IntlProvider>
  );
}

const choose = async (name: string) => {
  fireEvent.mouseDown(screen.getByRole('combobox'));
  fireEvent.click(await screen.findByText(name, { selector: '.ant-select-item-option-content' }));
};

beforeEach(() => {
  localStorage.clear();
  resetActiveLocaleForTests();
  umi.useAppLanguage(currentLocale);
  vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['en-US']);
});
afterEach(() => {
  vi.restoreAllMocks();
  resetActiveLocaleForTests();
  document.documentElement.lang = '';
});

describe('LangSwitch when the browser refuses site data', () => {
  it('changes the language when reading window.localStorage itself throws (blocked site data)', async () => {
    const error = vi.fn();
    window.addEventListener('error', error);
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    render(<Container />);
    await choose('简体中文');
    window.removeEventListener('error', error);
    expect(error).not.toHaveBeenCalled();
    expect(currentLocale()).toBe('zh-CN');
    expect(document.documentElement.lang).toBe('zh-CN');
    expect(document.querySelector('.ant-select-content')?.textContent).toBe('简体中文');
  });

  it('changes the language and keeps the choice when the browser lets it', async () => {
    render(<Container />);
    await choose('简体中文');
    expect(currentLocale()).toBe('zh-CN');
    expect(localStorage.getItem('umi_locale')).toBe('zh-CN');
    expect(document.documentElement.lang).toBe('zh-CN');
  });
});
