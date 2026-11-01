import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name.startsWith('.') ? [] : files(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\./.test(entry.name) ? [path] : [];
  });

// `const mine = ++counter.current` and `mine === counter.current`: a read that keeps only the answer
// of the newest one with a counter of its own.
const OWN_COUNTER = /const mine = \+\+\w+\.current|\bmine [!=]== \w+\.current/;

describe('the answer of the newest read', () => {
  it('is kept with useLatestRead or useLatestCall, not with a counter written again in a page', () => {
    const own = files('src')
      .filter((file) => !file.endsWith('useLatestCall.ts')) // the counter itself
      .filter((file) => OWN_COUNTER.test(readFileSync(file, 'utf8')))
      .map((file) => file.replaceAll('\\', '/'));
    expect(own).toEqual([]);
  });

  it('still sees such a counter when there is one (a guard against a scan that finds nothing)', () => {
    expect(OWN_COUNTER.test('const mine = ++counter.current;')).toBe(true);
    expect(OWN_COUNTER.test('if (mine === counter.current) setData(x);')).toBe(true);
    expect(OWN_COUNTER.test('if (!isCurrent()) return;')).toBe(false);
  });
});
