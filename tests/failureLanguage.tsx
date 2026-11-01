// Shared by the page tests that check a failure shown on a page follows the language: the page is
// drawn in English, a request fails, the page says so in English, the language is switched to
// Chinese while the page stays mounted, and every word of the failure is Chinese, without a new
// request. A page that keeps the text it made (instead of the failure itself) stays English.
import { act, render, screen, waitFor } from '@testing-library/react';
import { App } from 'antd';
import { type ReactElement, useEffect, useState } from 'react';
import { IntlProvider } from 'react-intl';
import { expect, vi } from 'vitest';
import enUS from '../src/locales/en-US';
import zhCN from '../src/locales/zh-CN';
import { envelope, jsonResponse, stubFetch } from './httpStubs';
import { jsonAnswer, overrideFetch } from './pageHelpers';

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

/** Draws a page the way `renderPage` does (in English) and lets the test switch the language while it stays mounted. */
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

/** The words of the failure that `failRequests` makes, in each language. */
export const SERVER_ERROR = {
  en: enUS['error.INTERNAL_ERROR'],
  zh: zhCN['error.INTERNAL_ERROR'],
};

/**
 * Makes the requests that `match` picks fail with a server error. Call it after `useMockBackend`
 * (the other requests go on to the mock backend). Returns the requests it failed.
 */
export function failRequests(match: RegExp | ((path: string, method: string) => boolean)) {
  return overrideFetch(({ url, method }) => {
    const path = url.pathname;
    const hit = typeof match === 'function' ? match(path, method) : match.test(`${method} ${path}`);
    return hit ? jsonAnswer(500, 'INTERNAL_ERROR') : undefined;
  });
}

/** Makes every request fail with a server error (no mock backend); returns the requests made. */
export function failEverything() {
  return stubFetch(() => jsonResponse(500, envelope('INTERNAL_ERROR')));
}

type Switcher = { switchTo: (locale: Locale) => unknown };

/**
 * The failure is on the page in English; after the switch it is on the page in Chinese, no element
 * that carries it still has a Latin letter (`allowed` lists what may stay, such as a name or UTC),
 * the English words are nowhere, and the switch made no request (the failure is made again from
 * the failure that was kept, not by reading again). The requests are counted here, from the
 * moment the English words are on the page: a request that a test fails itself never reaches the
 * mock backend, so its list of calls would not see it.
 */
export async function expectFailureFollowsLanguage(
  view: Switcher,
  options: {
    allowed?: RegExp;
    /** The words to look for, in each language; the server error unless the test makes another failure. */
    words?: { en: string; zh: string };
  } = {},
) {
  const words = options.words ?? SERVER_ERROR;
  const english = await screen.findAllByText(words.en, { exact: false });
  expect(english.length).toBeGreaterThan(0);
  let requests = 0;
  const inner = globalThis.fetch;
  vi.stubGlobal(
    'fetch',
    vi.fn((...args: Parameters<typeof fetch>) => {
      requests += 1;
      return inner(...args);
    }),
  );
  await view.switchTo('zh-CN');
  const chinese = await screen.findAllByText(words.zh, { exact: false });
  await waitFor(() => expect(screen.queryAllByText(words.en, { exact: false })).toEqual([]));
  expect(document.body.textContent).not.toContain(words.en);
  for (const node of chinese) {
    const text = (node.textContent ?? '').replace(options.allowed ?? /(?!)/g, '');
    expect(text, 'a word of the failure is still English').not.toMatch(/[A-Za-z]/);
  }
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(requests, 'the switch of the language made a request').toBe(0);
}

/**
 * Makes the requests that `match` picks refused with a 400 that names fields (`details`, each
 * `{ ref, reason }`): a dialog puts these reasons under its fields. Call it after `useMockBackend`.
 */
export function refuseRequests(
  match: RegExp | ((path: string, method: string) => boolean),
  details: { ref: string; reason: string }[],
) {
  return overrideFetch(({ url, method }) => {
    const hit =
      typeof match === 'function'
        ? match(url.pathname, method)
        : match.test(`${method} ${url.pathname}`);
    return hit ? jsonAnswer(400, 'INVALID_REQUEST', { details }) : undefined;
  });
}

/** The reason of a field in each language (a reason the language file knows, such as `TOO_LONG`). */
export const reasonWords = (reason: string) => ({
  en: (enUS as Record<string, string>)[`reason.${reason}`],
  zh: (zhCN as Record<string, string>)[`reason.${reason}`],
});

const reasonsUnderFields = () =>
  [...document.querySelectorAll<HTMLElement>('.ant-form-item-explain-error')].map(
    (node) => node.textContent ?? '',
  );

/** What the person has typed or chosen in the page now: one entry per input, in order. */
const typedValues = () =>
  [...document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')].map(
    (node) => `${node.type}:${node.value}:${'checked' in node ? node.checked : ''}`,
  );

/**
 * The reasons a dialog shows under its fields (the backend refused the save and named fields) follow
 * the language: they are in English under the fields, and after the switch every one of them is
 * Chinese (no Latin letter, `allowed` lists what may stay), the English words are nowhere on the
 * page, the switch made no request, and what the person typed is still in the boxes. Antd keeps
 * these words in the form, not in the page, so the page cannot make them again by itself.
 */
export async function expectFieldReasonsFollowLanguage(
  view: Switcher,
  options: {
    reason?: string;
    /** The words under the field, in each language, when they are not those of a reason. */
    words?: { en: string; zh: string };
    allowed?: RegExp;
    fields?: number;
  } = {},
) {
  const words = options.words ?? reasonWords(options.reason ?? 'TOO_LONG');
  await waitFor(() =>
    expect(
      reasonsUnderFields().filter((text) => text.includes(words.en)),
      'the reason is not under a field',
    ).not.toEqual([]),
  );
  if (options.fields !== undefined) {
    expect(reasonsUnderFields().filter((text) => text.includes(words.en))).toHaveLength(
      options.fields,
    );
  }
  const typed = typedValues();
  let requests = 0;
  const inner = globalThis.fetch;
  vi.stubGlobal(
    'fetch',
    vi.fn((...args: Parameters<typeof fetch>) => {
      requests += 1;
      return inner(...args);
    }),
  );
  await view.switchTo('zh-CN');
  await waitFor(() =>
    expect(
      reasonsUnderFields().filter((text) => text.includes(words.zh)),
      'the reason under the field is not in Chinese',
    ).not.toEqual([]),
  );
  await waitFor(() =>
    expect(reasonsUnderFields().filter((text) => text.includes(words.en))).toEqual([]),
  );
  for (const text of reasonsUnderFields()) {
    expect(
      text.replace(options.allowed ?? /(?!)/g, ''),
      'a reason under a field is still English',
    ).not.toMatch(/[A-Za-z]/);
  }
  if (options.fields !== undefined) {
    expect(reasonsUnderFields().filter((text) => text.includes(words.zh))).toHaveLength(
      options.fields,
    );
  }
  expect(document.body.textContent).not.toContain(words.en);
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(requests, 'the switch of the language made a request').toBe(0);
  expect(typedValues(), 'what the person typed was lost').toEqual(typed);
}
