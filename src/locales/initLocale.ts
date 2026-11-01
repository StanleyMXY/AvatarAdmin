import { getLocale, setLocale } from '@umijs/max';
import { adoptLocale, decideLocale } from './activeLocale';

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
