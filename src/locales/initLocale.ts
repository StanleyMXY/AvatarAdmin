import { getLocale, setLocale } from '@umijs/max';
import { LOCALE_STORAGE_KEY } from '../request/apiClient';
import { resolveInitialLocale } from '../utils/resolveLocale';

/**
 * Chooses the language the console starts in: the saved choice (Umi keeps it in localStorage), else
 * the browser's language, where anything Chinese is zh-CN and everything else is en-US. Umi itself
 * would start in its configured default; this puts the language right before the first page is drawn.
 */
export function applyInitialLocale(
  set: (locale: string, reload: boolean) => void = setLocale,
): void {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  } catch {
    // storage is not available: the browser's language decides
  }
  const languages =
    typeof navigator === 'undefined'
      ? []
      : navigator.languages?.length
        ? navigator.languages
        : [navigator.language];
  const wanted = resolveInitialLocale(stored, languages);
  if (getLocale() !== wanted) set(wanted, false);
  markPageLanguage(wanted);
}

/** `<html lang>`: read by screen readers and used by the browser to pick fonts for Chinese text. */
export function markPageLanguage(locale: string): void {
  if (typeof document !== 'undefined') document.documentElement.lang = locale;
}
