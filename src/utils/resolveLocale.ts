export type AppLocale = 'zh-CN' | 'en-US';

export const APP_LOCALES: readonly AppLocale[] = ['zh-CN', 'en-US'];

/**
 * The language to start in: the saved choice if it is one of the two interface languages,
 * otherwise by the browser's preferred (first) language, where zh and anything starting with
 * zh- or zh_ is zh-CN and every other language, or none, is en-US.
 */
export function resolveInitialLocale(
  stored: string | null,
  browserLanguages: readonly string[],
): AppLocale {
  const saved = APP_LOCALES.find((locale) => locale === stored);
  if (saved) return saved;
  const preferred = browserLanguages[0] ?? '';
  return /^zh(?:[-_]|$)/i.test(preferred) ? 'zh-CN' : 'en-US';
}
