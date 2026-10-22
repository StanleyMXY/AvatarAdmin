import { join } from 'node:path';
import { defineConfig } from 'vitest/config';

// Node 22+ ships its own `localStorage`, which is unusable without `--localstorage-file` and
// shadows happy-dom's. Switch it off in the test workers (the flag does not exist before 22.4).
const [nodeMajor, nodeMinor] = process.versions.node.split('.').map(Number);
const hasWebStorageFlag = nodeMajor > 22 || (nodeMajor === 22 && nodeMinor >= 4);
const execArgv = hasWebStorageFlag ? ['--no-experimental-webstorage'] : [];

// `@umijs/max` and `@ant-design/plots` are aliased to small stand-ins so component tests do not
// need the Umi runtime or a canvas; application code still imports the real package names.
export default defineConfig({
  resolve: {
    alias: {
      '@umijs/max': join(__dirname, 'tests/stubs/umi-max.tsx'),
      '@ant-design/plots': join(__dirname, 'tests/stubs/plots.tsx'),
      '@@': join(__dirname, 'src/.umi'),
      '@root': __dirname,
      '@': join(__dirname, 'src'),
    },
  },
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'happy-dom',
    globals: true,
    pool: 'forks',
    execArgv,
    setupFiles: ['./tests/setup.ts'],
    include: ['{src,mock,config,scripts,tests}/**/*.test.{ts,tsx}'],
  },
});
