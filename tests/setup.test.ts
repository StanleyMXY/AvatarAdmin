import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getConfig } from '@testing-library/dom';
import { describe, expect, it } from 'vitest';

const setupFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name.startsWith('.') ? [] : setupFiles(path);
    return entry.name === 'testSetup.ts' ? [path] : [];
  });

describe('how long a test waits for something to appear', () => {
  it('is set once for every test in tests/setup.ts: eight seconds, the longest any module needed', () => {
    expect(getConfig().asyncUtilTimeout).toBe(8000);
  });

  it('is not set again in the setup file of a module', () => {
    const again = setupFiles('src')
      .filter((file) => /asyncUtilTimeout/.test(readFileSync(file, 'utf8')))
      .map((file) => file.replaceAll('\\', '/'));
    expect(again).toEqual([]);
  });
});
