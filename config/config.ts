import { defineConfig } from '@umijs/max';
import { buildVars, toDefine } from './buildVars';
import proxy from './proxy';
import routes from './routes';

export default defineConfig({
  hash: true,
  // Without this, `max build` fails at esbuild's helper check (verified when the stack was chosen).
  esbuildMinifyIIFE: true,
  npmClient: 'npm',
  model: {},
  initialState: {},
  access: {},
  layout: {
    title: buildVars.ADMIN_PRODUCT_NAME,
  },
  locale: {
    // Initial language is resolved by the app itself; Umi only provides the intl plumbing.
    default: 'en-US',
    antd: true,
    baseNavigator: false,
  },
  antd: {},
  define: toDefine(buildVars),
  proxy,
  routes,
});
