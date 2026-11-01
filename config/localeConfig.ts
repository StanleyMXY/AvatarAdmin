/**
 * Umi's locale plugin. The language is chosen by the app itself (`src/locales/activeLocale.ts`:
 * the saved choice, else the browser's language, else English), so Umi must not read or write
 * localStorage on its own: in a browser that refuses storage it throws before the language has
 * changed, and its idea of the language then differs from what the person sees.
 */
export const localeConfig = {
  default: 'en-US',
  antd: true,
  baseNavigator: false,
  useLocalStorage: false,
};
