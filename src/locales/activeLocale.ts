import { LOCALE_STORAGE_KEY } from '../request/apiClient';
import { type AppLocale, resolveInitialLocale } from '../utils/resolveLocale';

// The language the console is shown in. It is held here, in memory, so that a browser which refuses
// storage (blocked site data, private windows) still changes language and still answers "which
// language" consistently to the drop-down, the page text and the Accept-Language header; the saved
// copy in localStorage is only for the next visit.
let chosen: AppLocale | undefined;

function stored(): string | null {
  try {
    return localStorage.getItem(LOCALE_STORAGE_KEY);
  } catch {
    return null; // storage is not available: the browser's language decides
  }
}

function browserLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') return [];
  return navigator.languages?.length ? navigator.languages : [navigator.language];
}

/** The language to start in: the saved one, else by the browser. */
export function decideLocale(): AppLocale {
  return resolveInitialLocale(stored(), browserLanguages());
}

/** The language in use: the one chosen in this page, else the one to start in. */
export function currentLocale(): AppLocale {
  return chosen ?? decideLocale();
}

/** Takes `locale` as the language in use for this page, without saving it (the start-up decision is not a choice). */
export function adoptLocale(locale: AppLocale): void {
  chosen = locale;
}

/** The person chose `locale`: it is the language in use now and is saved for the next visit when the browser lets us. */
export function rememberLocale(locale: AppLocale): void {
  adoptLocale(locale);
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // the choice then lasts until the page is closed
  }
}

/** Forgets the choice held in memory (tests). */
export function resetActiveLocaleForTests(): void {
  chosen = undefined;
}
