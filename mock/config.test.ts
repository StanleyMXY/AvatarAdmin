import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Umi's mock loader would try to load every file under mock/ that is not excluded; a helper or a
// test file in the list makes the dev server fail to start the mock backend.
const globToRegExp = (glob: string) =>
  new RegExp(
    `^${glob
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*\//g, '(?:.*/)?')
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')}$`,
  );

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`],
  );

describe('mock.exclude in config/config.ts', () => {
  const source = readFileSync('config/config.ts', 'utf8');
  const exclude = [
    ...(/mock:\s*\{\s*exclude:\s*\[([^\]]*)\]/.exec(source)?.[1] ?? '').matchAll(/'([^']+)'/g),
  ].map((m) => m[1]);

  it('is there', () => {
    expect(exclude.length).toBeGreaterThan(0);
  });

  it('excludes every helper and every test file under mock/', () => {
    const patterns = exclude.map(globToRegExp);
    const isExcluded = (file: string) => patterns.some((re) => re.test(file));
    for (const file of walk('mock').filter(
      (f) => f.startsWith('mock/_core/') || f.endsWith('.test.ts'),
    )) {
      expect(isExcluded(file), file).toBe(true);
    }
  });

  it('does not exclude an endpoint file', () => {
    const patterns = exclude.map(globToRegExp);
    const endpoints = walk('mock').filter((f) => f.endsWith('.mock.ts'));
    expect(endpoints.length).toBeGreaterThan(0);
    for (const file of endpoints)
      expect(
        patterns.some((re) => re.test(file)),
        file,
      ).toBe(false);
  });

  it('every endpoint file default-exports an object whose keys are "METHOD /api/admin/..."', async () => {
    for (const file of walk('mock').filter((f) => f.endsWith('.mock.ts'))) {
      const module = await import(/* @vite-ignore */ `../${file}`);
      for (const [key, handler] of Object.entries(module.default as Record<string, unknown>)) {
        expect(key, file).toMatch(/^(GET|POST|PUT|DELETE|PATCH) \/api\/admin\//);
        expect(typeof handler, `${file} ${key}`).toBe('function');
      }
    }
  });
});
