import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { evaluate, parseDiagnostics, shouldCheck } from './typecheck-staged.mjs';

const SCRIPT = join(__dirname, 'typecheck-staged.mjs');
const REAL_TSC = join(__dirname, '..', 'node_modules', 'typescript', 'bin', 'tsc');

// Real tsc output captured from tsc 5.9.3 for the failure shapes the hook must understand.
const OUT_BROKEN_SYNTAX = `a.ts(1,14): error TS2322: Type 'string' is not assignable to type 'number'.
tsconfig.json(2,1): error TS1005: '}' expected.
`;
const OUT_UNKNOWN_OPTION = `tsconfig.json(1,24): error TS5023: Unknown compiler option 'bogus'.
`;
const OUT_MISSING_FILE = `error TS6053: File 'D:/tmp/t1-tsc/missing.ts' not found.
  The file is in the program because:
    Part of 'files' list in tsconfig.json
`;
const OUT_USAGE =
  'Version 5.9.3\ntsc: The TypeScript Compiler - Version 5.9.3\n\nCOMMON COMMANDS\n';

describe('shouldCheck', () => {
  it('runs for TypeScript, tsconfig and package.json, not for other files', () => {
    expect(shouldCheck(['src/a.ts'])).toBe(true);
    expect(shouldCheck(['src/a.tsx'])).toBe(true);
    expect(shouldCheck(['tsconfig.json'])).toBe(true);
    expect(shouldCheck(['tsconfig.build.json'])).toBe(true);
    expect(shouldCheck(['package.json'])).toBe(true);
    expect(shouldCheck(['README.md', 'src/style.css'])).toBe(false);
  });
});

describe('parseDiagnostics', () => {
  it('reads located and unlocated diagnostics and keeps continuation lines', () => {
    const parsed = parseDiagnostics(OUT_MISSING_FILE + OUT_BROKEN_SYNTAX, process.cwd());
    expect(parsed.map((d) => [d.file, d.code])).toEqual([
      [null, 'TS6053'],
      ['a.ts', 'TS2322'],
      ['tsconfig.json', 'TS1005'],
    ]);
    expect(parsed[0].lines).toHaveLength(3);
  });

  it('ignores usage text', () => {
    expect(parseDiagnostics(OUT_USAGE)).toEqual([]);
  });
});

describe('evaluate', () => {
  const staged = ['src/a.ts'];
  const run = (result: object, stagedFiles: string[] = staged) =>
    evaluate({ stagedFiles, result, root: process.cwd() });

  it('passes when tsc passes', () => {
    expect(run({ status: 0, stdout: '', stderr: '' }).exitCode).toBe(0);
  });

  it('fails when tsc could not be started (result.error)', () => {
    const outcome = run({
      error: new Error('spawn ENOENT'),
      status: null,
      stdout: null,
      stderr: null,
    });
    expect(outcome.exitCode).toBe(1);
    expect(outcome.errors.join('\n')).toContain('could not be run');
  });

  it('fails when tsc was killed by a signal (status null)', () => {
    const outcome = run({ status: null, signal: 'SIGKILL', stdout: '', stderr: '' });
    expect(outcome.exitCode).toBe(1);
    expect(outcome.errors.join('\n')).toContain('SIGKILL');
  });

  it('fails when tsc exits non-zero with no output (for example a crash with status 139)', () => {
    expect(run({ status: 139, stdout: '', stderr: '' }).exitCode).toBe(1);
  });

  it('fails on an out-of-memory abort', () => {
    const stderr =
      'FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory\n';
    expect(run({ status: 2, stdout: '', stderr }).exitCode).toBe(1);
  });

  it('fails when tsc printed only usage text', () => {
    expect(run({ status: 1, stdout: OUT_USAGE, stderr: '' }).exitCode).toBe(1);
  });

  it('fails on a diagnostic without a location (missing file in tsconfig)', () => {
    const outcome = run({ status: 2, stdout: OUT_MISSING_FILE, stderr: '' });
    expect(outcome.exitCode).toBe(1);
    expect(outcome.errors.join('\n')).toContain('TS6053');
  });

  it('fails on an unknown tsconfig option even though tsconfig.json is not staged', () => {
    expect(run({ status: 2, stdout: OUT_UNKNOWN_OPTION, stderr: '' }).exitCode).toBe(1);
  });

  it('fails on a syntactically broken tsconfig even if the other diagnostic is elsewhere', () => {
    expect(run({ status: 2, stdout: OUT_BROKEN_SYNTAX, stderr: '' }, ['src/b.ts']).exitCode).toBe(
      1,
    );
  });

  it('fails on a type error in a staged file', () => {
    const stdout =
      "src/a.ts(3,1): error TS2322: Type 'string' is not assignable to type 'number'.\n";
    const outcome = run({ status: 2, stdout, stderr: '' });
    expect(outcome.exitCode).toBe(1);
    expect(outcome.errors.join('\n')).toContain('src/a.ts(3,1)');
  });

  it('only warns about type errors in files that are not staged', () => {
    const stdout =
      "src/other.ts(3,1): error TS2322: Type 'string' is not assignable to type 'number'.\n";
    const outcome = run({ status: 2, stdout, stderr: '' });
    expect(outcome.exitCode).toBe(0);
    expect(outcome.errors).toEqual([]);
    expect(outcome.warnings.join('\n')).toContain('src/other.ts(3,1)');
  });
});

// ---- end to end: the real script in a throwaway git repository ----
const temps: string[] = [];
afterAll(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

const GOOD_TSCONFIG = JSON.stringify({
  compilerOptions: { strict: true, noEmit: true, types: [] },
  include: ['*.ts'],
});

type Fake = { stdout?: string; stderr?: string; status: number };

function makeRepo(files: Record<string, string>, fake?: Fake): string {
  const dir = mkdtempSync(join(tmpdir(), 'typecheck-staged-'));
  temps.push(dir);
  const git = (...args: string[]) => spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
  git('init', '-q');
  mkdirSync(join(dir, 'node_modules', 'typescript', 'bin'), { recursive: true });
  // A stand-in tsc: replays a canned result when fake-tsc.json exists, else runs the real one.
  writeFileSync(
    join(dir, 'node_modules', 'typescript', 'bin', 'tsc'),
    `const fs = require('fs');
if (fs.existsSync('fake-tsc.json')) {
  const c = JSON.parse(fs.readFileSync('fake-tsc.json', 'utf8'));
  fs.writeFileSync('tsc-was-run', '1');
  if (c.stdout) process.stdout.write(c.stdout);
  if (c.stderr) process.stderr.write(c.stderr);
  process.exit(c.status);
}
fs.writeFileSync('tsc-was-run', '1');
require(${JSON.stringify(REAL_TSC)});
`,
  );
  if (fake) writeFileSync(join(dir, 'fake-tsc.json'), JSON.stringify(fake));
  for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content);
  return dir;
}

function stage(dir: string, ...names: string[]) {
  const result = spawnSync('git', ['add', '--', ...names], { cwd: dir, encoding: 'utf8' });
  expect(result.status).toBe(0);
}

function runHook(dir: string) {
  const result = spawnSync(process.execPath, [SCRIPT], { cwd: dir, encoding: 'utf8' });
  return {
    status: result.status,
    out: `${result.stdout}${result.stderr}`,
    tscRan: existsSync(join(dir, 'tsc-was-run')),
  };
}

describe('typecheck-staged.mjs end to end', () => {
  const GOOD = 'export const good: number = 1;\n';
  const BAD = "export const bad: number = 'x';\n";

  it('fails when tsc crashes silently with status 139', () => {
    const dir = makeRepo({ 'a.ts': GOOD }, { status: 139 });
    stage(dir, 'a.ts');
    expect(runHook(dir).status).toBe(1);
  });

  it('fails when tsc dies with an out-of-memory message and status 2', () => {
    const dir = makeRepo(
      { 'a.ts': GOOD },
      { status: 2, stderr: 'FATAL ERROR: Reached heap limit - JavaScript heap out of memory\n' },
    );
    stage(dir, 'a.ts');
    expect(runHook(dir).status).toBe(1);
  });

  it('fails on an unknown tsconfig option (canned tsc output)', () => {
    const dir = makeRepo({ 'a.ts': GOOD }, { status: 2, stdout: OUT_UNKNOWN_OPTION });
    stage(dir, 'a.ts');
    expect(runHook(dir).status).toBe(1);
  });

  it('passes a clean project and does not run tsc for unrelated staged files', () => {
    const clean = makeRepo({ 'a.ts': GOOD, 'tsconfig.json': GOOD_TSCONFIG });
    stage(clean, 'a.ts');
    expect(runHook(clean).status).toBe(0);

    const unrelated = makeRepo({ 'README.md': 'x\n' });
    stage(unrelated, 'README.md');
    const outcome = runHook(unrelated);
    expect(outcome.status).toBe(0);
    expect(outcome.tscRan).toBe(false);
  });

  it('fails on a type error in a staged file, warns about one in an unstaged file (real tsc)', () => {
    const bad = makeRepo({ 'bad.ts': BAD, 'tsconfig.json': GOOD_TSCONFIG });
    stage(bad, 'bad.ts');
    const failing = runHook(bad);
    expect(failing.status).toBe(1);
    expect(failing.out).toContain('bad.ts(1,14)');

    const mixed = makeRepo({ 'good.ts': GOOD, 'bad.ts': BAD, 'tsconfig.json': GOOD_TSCONFIG });
    stage(mixed, 'good.ts');
    const passing = runHook(mixed);
    expect(passing.status).toBe(0);
    expect(passing.out).toContain('warning');
    expect(passing.out).toContain('bad.ts(1,14)');
  });

  it('fails when tsconfig.json lists a missing file (TS6053, no location; real tsc)', () => {
    const dir = makeRepo({
      'a.ts': GOOD,
      'tsconfig.json': JSON.stringify({ files: ['missing.ts'] }),
    });
    stage(dir, 'a.ts');
    const outcome = runHook(dir);
    expect(outcome.status).toBe(1);
    expect(outcome.out).toContain('TS6053');
  });

  it('fails on a syntactically broken tsconfig.json whether or not it is staged (real tsc)', () => {
    const broken = '{ "compilerOptions": { "strict": true, }\n';
    const unstaged = makeRepo({ 'a.ts': GOOD, 'tsconfig.json': broken });
    stage(unstaged, 'a.ts');
    expect(runHook(unstaged).status).toBe(1);

    const onlyConfig = makeRepo({ 'a.ts': GOOD, 'tsconfig.json': broken });
    stage(onlyConfig, 'tsconfig.json');
    const outcome = runHook(onlyConfig);
    expect(outcome.tscRan).toBe(true);
    expect(outcome.status).toBe(1);
  });

  it('runs tsc when only tsconfig.json or package.json is staged', () => {
    const config = makeRepo({ 'tsconfig.json': GOOD_TSCONFIG }, { status: 0 });
    stage(config, 'tsconfig.json');
    expect(runHook(config).tscRan).toBe(true);

    const pkg = makeRepo({ 'package.json': '{}\n' }, { status: 0 });
    stage(pkg, 'package.json');
    expect(runHook(pkg).tscRan).toBe(true);
  });

  it('fails when typescript is not installed', () => {
    const dir = makeRepo({ 'a.ts': GOOD });
    rmSync(join(dir, 'node_modules'), { recursive: true, force: true });
    stage(dir, 'a.ts');
    expect(runHook(dir).status).toBe(1);
  });
});
