import { defineConfig } from '@umijs/max';
import { buildVars, toDefine } from './buildVars';
import { localeConfig } from './localeConfig';
import proxy from './proxy';
import routes from './routes';

export default defineConfig({
  hash: true,
  // The browser tab title before and between pages; Umi's layout adds the page name to it.
  title: buildVars.ADMIN_PRODUCT_NAME,
  // Without this, `max build` fails at esbuild's helper check (verified when the stack was chosen).
  esbuildMinifyIIFE: true,
  npmClient: 'npm',
  model: {},
  initialState: {},
  access: {},
  layout: {
    title: buildVars.ADMIN_PRODUCT_NAME,
  },
  // Initial language is resolved by the app itself; Umi only provides the intl plumbing.
  locale: localeConfig,
  antd: {},
  define: toDefine(buildVars),
  proxy,
  // Tools and tests in mock/ are not endpoint files.
  mock: { exclude: ['mock/_core/**', 'mock/**/*.test.ts'] },
  routes,
});
