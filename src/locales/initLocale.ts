import { addLocale, getLocale, setLocale } from '@umijs/max';
import type { AppLocale } from '../utils/resolveLocale';
import { adoptLocale, decideLocale, rememberLocale } from './activeLocale';

// Umi's `addLocale` registers messages for a language and, when that language is the one in use,
// announces it so that the tree is drawn again; no messages are added here.
const announceLocale = addLocale as unknown as (name: string, messages: object) => void;

/**
 * Chooses the language the console starts in: the saved choice (kept in localStorage by `rememberLocale`), else
 * the browser's language, where anything Chinese is zh-CN and everything else is en-US. Umi itself
 * would start in its configured default; this puts the language right before the first page is drawn.
 */
export function applyInitialLocale(
  set: (locale: string, reload: boolean) => void = setLocale,
): void {
  const wanted = decideLocale();
  // From here on this is the language in use, whatever the browser lets Umi read back.
  adoptLocale(wanted);
  if (getLocale() !== wanted) set(wanted, false);
  markPageLanguage(wanted);
}

/** `<html lang>`: read by screen readers and used by the browser to pick fonts for Chinese text. */
export function markPageLanguage(locale: string): void {
  if (typeof document !== 'undefined') document.documentElement.lang = locale;
}

/**
 * The person chose `locale`. The app's own record of the language is changed first (in memory, then
 * in localStorage when the browser lets it), and Umi is told afterwards that the language in use
 * has changed. Umi's `setLocale` is not used: it reads `window.localStorage` before it checks that
 * it may, and in a browser that blocks site data that read throws and nothing changes.
 */
export function switchLocale(locale: string): void {
  rememberLocale(locale as AppLocale);
  markPageLanguage(locale);
  announceLocale(locale, {});
}
