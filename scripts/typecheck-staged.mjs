// Pre-commit type check that fails only on diagnostics located in staged files.
//
// Several people (and agents) commit in the same working tree while other files are half
// written, so a whole-project `tsc` failure must not block an unrelated commit. We still run
// the whole project (types flow across files), parse the diagnostics, and:
//   - exit 1 if any diagnostic is located in a staged file;
//   - print diagnostics in other files (and location-less ones) as a warning and exit 0.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();

function run(command, args) {
  return spawnSync(command, args, { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
}

const staged = run('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR']);
if (staged.status !== 0) {
  console.error(`typecheck-staged: could not list staged files\n${staged.stderr}`);
  process.exit(1);
}
const stagedFiles = new Set(
  staged.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((file) => file.replace(/\\/g, '/')),
);
if (![...stagedFiles].some((file) => /\.(ts|tsx|mts|cts|d\.ts)$/.test(file))) {
  process.exit(0); // nothing type-checkable is staged
}

const tscBin = resolve(root, 'node_modules/typescript/bin/tsc');
if (!existsSync(tscBin)) {
  console.error('typecheck-staged: typescript is not installed; run npm install');
  process.exit(1);
}
const result = run(process.execPath, [tscBin, '--noEmit', '--pretty', 'false']);
const output = `${result.stdout}${result.stderr}`;
if (result.status === 0) process.exit(0);

// A diagnostic starts with `path(line,col): error TSxxxx: message`; indented lines continue it.
const start = /^(.+?)\((\d+),(\d+)\): (error|warning) (TS\d+): /;
const diagnostics = [];
for (const line of output.split(/\r?\n/)) {
  const match = start.exec(line);
  if (match) {
    diagnostics.push({ file: match[1].replace(/\\/g, '/'), lines: [line] });
  } else if (diagnostics.length > 0 && /^\s+\S/.test(line)) {
    diagnostics[diagnostics.length - 1].lines.push(line);
  } else if (line.trim() !== '') {
    diagnostics.push({ file: null, lines: [line] });
  }
}

const mine = diagnostics.filter((d) => d.file !== null && stagedFiles.has(d.file));
const others = diagnostics.filter((d) => !mine.includes(d));

if (others.length > 0) {
  console.warn(
    `typecheck-staged: warning, ${others.length} diagnostic(s) outside the staged files (not blocking):`,
  );
  for (const d of others) console.warn(d.lines.join('\n'));
}
if (mine.length > 0) {
  console.error(`typecheck-staged: ${mine.length} type error(s) in staged files:`);
  for (const d of mine) console.error(d.lines.join('\n'));
  process.exit(1);
}
process.exit(0);
