import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PERMISSION_CODES } from '../src/access/permissionCodes';
import { extractPermissionCodes, parseExclusions, sectionText } from './permissionCodes';

const SPEC = 'docs/shared-snapshots/admin-frontend-design.md';
const CONTRACT = 'docs/shared-snapshots/backend-task-java-backend.md';
const EXCLUSIONS = 'docs/superpowers/handoff/permission-code-exclusions.txt';

describe('sectionText', () => {
  const text = [
    '# T',
    '## 1 a',
    'one `A:B`',
    '### 1.1 sub',
    'sub `C:D`',
    '## 2 b',
    'two `E:F`',
  ].join('\n');

  it('takes a heading and everything under it up to the next heading of the same or a higher level', () => {
    expect(sectionText(text, /^## 1 /)).toContain('sub `C:D`');
    expect(sectionText(text, /^## 1 /)).not.toContain('two');
  });

  it('stops a sub-heading section at the next heading of its level', () => {
    expect(sectionText(text, /^### 1\.1 /)).toContain('sub `C:D`');
    expect(sectionText(text, /^### 1\.1 /)).not.toContain('one');
    expect(sectionText(text, /^### 1\.1 /)).not.toContain('two');
  });

  it('runs to the end of the file for the last section', () => {
    expect(sectionText(text, /^## 2 /)).toContain('two `E:F`');
  });

  it('is empty when the heading is not there', () => {
    expect(sectionText(text, /^## 9 /)).toBe('');
  });
});

describe('parseExclusions', () => {
  it('reads one token per line and ignores comments and blank lines', () => {
    expect(parseExclusions('# note\n\nA:B\n  C:D  \n# more\n')).toEqual(['A:B', 'C:D']);
  });
});

describe('extractPermissionCodes on the snapshots', () => {
  const spec = readFileSync(SPEC, 'utf8');
  const contract = readFileSync(CONTRACT, 'utf8');
  const exclusions = parseExclusions(readFileSync(EXCLUSIONS, 'utf8'));
  const result = extractPermissionCodes(spec, contract, exclusions);

  it('finds the 82 words the plan counted, and 79 codes after the exclusions', () => {
    expect(result.raw).toHaveLength(82);
    expect(exclusions).toHaveLength(3);
    expect(result.codes).toHaveLength(79);
  });

  it('excludes exactly the listed tokens', () => {
    expect(result.raw.filter((w) => !result.codes.includes(w)).sort()).toEqual(
      [...exclusions].sort(),
    );
  });

  it('equals PERMISSION_CODES', () => {
    expect([...PERMISSION_CODES].sort()).toEqual(result.codes);
  });

  it('every excluded token really is in the raw output, so a stale exclusion is noticed', () => {
    for (const token of exclusions) expect(result.raw).toContain(token);
  });

  it('finds codes in both documents: the spec text names four that its route table does not', () => {
    const specOnly = extractPermissionCodes(spec, '', []);
    expect(specOnly.raw.length).toBeGreaterThan(40);
    expect(result.raw.length).toBeGreaterThan(specOnly.raw.length);
  });
});

describe('check-permission-codes.ts', { timeout: 60_000 }, () => {
  const run = (args: string[]) =>
    spawnSync('npx', ['tsx', 'scripts/check-permission-codes.ts', ...args], { encoding: 'utf8' });

  it('exits 0 and says 79 when the list agrees', () => {
    const result = run([SPEC, CONTRACT]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('79');
  });

  it('exits 1 and names the problem when the arguments are missing', () => {
    const result = run([]);
    expect(result.status).toBe(1);
    expect(result.stderr + result.stdout).toMatch(/usage/i);
  });

  it('exits 1 and names the code when the contract has one that PERMISSION_CODES lacks', () => {
    const dir = mkdtempSync(join(tmpdir(), 'perm-codes-'));
    const changed = join(dir, 'contract.md');
    writeFileSync(
      changed,
      readFileSync(CONTRACT, 'utf8').replace('### 17.3 ', '### 17.3 `ZZZ:NEW_CODE` '),
    );
    const result = run([SPEC, changed]);
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain('ZZZ:NEW_CODE');
  });

  it('exits 1 and names the code when PERMISSION_CODES has one the contract no longer has', () => {
    const dir = mkdtempSync(join(tmpdir(), 'perm-codes-'));
    const changed = join(dir, 'contract.md');
    writeFileSync(
      changed,
      readFileSync(CONTRACT, 'utf8').replaceAll('`AUDIT:VIEW`', '`AUDIT_VIEW`'),
    );
    const spec = join(dir, 'spec.md');
    writeFileSync(spec, readFileSync(SPEC, 'utf8').replaceAll('`AUDIT:VIEW`', '`AUDIT_VIEW`'));
    const result = run([spec, changed]);
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain('AUDIT:VIEW');
  });
});
