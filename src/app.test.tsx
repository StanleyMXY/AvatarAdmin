import { render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLocale, resetUmiStub, setLocale } from '../tests/stubs/umi-max';
import { layout, render as renderHook, rootContainer } from './app';
import { buildVars } from './buildVars';
import { applyInitialLocale } from './locales/initLocale';
import { apiRequest } from './request/apiClient';
import { resetThemeModeForTests } from './theme/modes';

beforeEach(() => {
  resetUmiStub();
  resetThemeModeForTests();
});

const config = (me?: { superAdmin: boolean; permissions: string[]; username?: string }) =>
  layout({ initialState: me ? { me } : undefined });

describe('layout', () => {
  it('takes the title and logo from the build variables, with the sizes of the spec', () => {
    const c = config();
    expect(c.title).toBe(buildVars.productName);
    expect(c.logo).toBe(buildVars.logoUrl);
    expect(c.siderWidth).toBe(240);
    expect(c.headerHeight).toBe(56);
    expect(c.fixedHeader).toBe(true);
    expect(c.layout).toBe('mix');
  });

  it('has no external address anywhere in it', () => {
    expect(
      JSON.stringify({
        ...config(),
        childrenRender: undefined,
        actionsRender: undefined,
        avatarProps: undefined,
      }),
    ).not.toMatch(/https?:\/\//);
  });

  it('shows the 403 page and the 404 page from the language files', () => {
    const c = config({ superAdmin: false, permissions: [] });
    render(
      <IntlProvider
        locale="en-US"
        messages={{ 'pages.403.title': 'No permission', 'pages.404.title': 'Page not found' }}
        onError={() => {}}
      >
        {c.unAccessible}
        {c.noFound}
      </IntlProvider>,
    );
    expect(screen.getByText('No permission')).toBeInTheDocument();
    expect(screen.getByText('Page not found')).toBeInTheDocument();
  });

  it('puts the language and theme switches in the header', () => {
    const actions = config({ superAdmin: true, permissions: [] }).actionsRender();
    expect(actions).toHaveLength(2);
  });
});

describe('rootContainer', () => {
  it('wraps the app so that the theme can change without a reload and sets the page theme', () => {
    render(
      <IntlProvider locale="en-US" onError={() => {}}>
        {rootContainer(<div data-testid="app" />)}
      </IntlProvider>,
    );
    expect(screen.getByTestId('app')).toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBe('dim');
  });
});

describe('render (Umi startup hook)', () => {
  it('chooses the language first and then draws', () => {
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['zh-CN']);
    const order: string[] = [];
    renderHook(() => order.push(`draw with ${getLocale()}`));
    expect(order).toEqual(['draw with zh-CN']);
  });
});

describe('importing the app', () => {
  it('does not ask Umi for the language while the file is loaded: its plugin manager is not there yet', async () => {
    vi.resetModules();
    const umi = await import('@umijs/max');
    const spy = vi.spyOn(umi, 'getLocale');
    const setSpy = vi.spyOn(umi, 'setLocale');
    await import('./app');
    expect(spy).not.toHaveBeenCalled();
    expect(setSpy).not.toHaveBeenCalled();
  });
});

describe('the language', () => {
  const languages = (list: string[]) =>
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(list);

  it('starts in the saved language', () => {
    localStorage.setItem('umi_locale', 'zh-CN');
    languages(['en-US']);
    applyInitialLocale();
    expect(getLocale()).toBe('zh-CN');
  });

  it('otherwise follows the browser: any Chinese gives zh-CN, anything else en-US', () => {
    languages(['zh-TW']);
    applyInitialLocale();
    expect(getLocale()).toBe('zh-CN');
    setLocale('zh-CN');
    languages(['th-TH', 'en']);
    localStorage.clear();
    applyInitialLocale();
    expect(getLocale()).toBe('en-US');
  });

  it('marks the page with the language it starts in', () => {
    languages(['zh-CN']);
    applyInitialLocale();
    expect(document.documentElement.lang).toBe('zh-CN');
    setLocale('en-US');
    languages(['en']);
    applyInitialLocale();
    expect(document.documentElement.lang).toBe('en-US');
  });

  it('does not touch the language when it is right already', () => {
    languages(['en']);
    const before = vi.fn();
    applyInitialLocale(before as never);
    expect(before).not.toHaveBeenCalled();
  });

  it('works when localStorage cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    languages(['zh']);
    expect(() => applyInitialLocale()).not.toThrow();
    expect(getLocale()).toBe('zh-CN');
  });

  it('sends the current language in Accept-Language: the request layer asks Umi', async () => {
    const calls: Record<string, string>[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        calls.push(init.headers as Record<string, string>);
        return new Response(JSON.stringify({ code: '200', message: 'success', data: null }), {
          status: 200,
        });
      }),
    );
    setLocale('zh-CN');
    await apiRequest({ method: 'GET', url: '/me' });
    expect(calls[0]['Accept-Language']).toBe('zh-CN');
    vi.unstubAllGlobals();
  });
});
