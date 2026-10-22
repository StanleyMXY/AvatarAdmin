// Logic of the pre-commit type check (the hook runs typecheck-staged.mjs, a thin entry point with
// no 'am I the main module' guard: such a guard compares paths and fails open when the repository
// is reached through a junction, a symlink or a different drive-letter spelling).
//
// Pre-commit type check that fails only on type errors located in staged files.
//
// Several people (and agents) commit in the same working tree while other files are half
// written, so a whole-project `tsc` failure must not block an unrelated commit. We still run the
// whole project (types flow across files), parse the diagnostics, and:
//   - fail on a diagnostic located in a staged file;
//   - print diagnostics located in other files as a warning and let the commit through;
//   - fail whenever tsc itself could not do its job, because then nothing was checked:
//       * tsc could not be started, or was killed by a signal;
//       * tsc exited non-zero but no diagnostic could be read from its output (crash, out of
//         memory, usage text);
//       * a diagnostic without a file location (for example TS6053 "File not found", TS5083
//         "Cannot read file") or one located in a .json file (tsconfig problems, for example an
//         unknown compiler option): the configuration is wrong, so source files were not
//         reliably checked.
// The check also runs when only tsconfig*.json or package.json is staged.
//
// Note: tsc reads the working tree, not the index, so a partly staged file is checked as it is on
// disk.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';

const TYPE_FILE = /\.(ts|tsx|mts|cts)$/;
const CONFIG_FILE = /(^|\/)(tsconfig[^/]*\.json|package\.json)$/;
const LOCATED = /^(.+?)\((\d+),(\d+)\): error (TS\d+): /;
const UNLOCATED = /^error (TS\d+): /;

function toPosix(path) {
  return path.split(sep).join('/').replace(/\\/g, '/');
}

/** True when the staged file list contains something tsc output could be about. */
export function shouldCheck(stagedFiles) {
  return [...stagedFiles].some((file) => TYPE_FILE.test(file) || CONFIG_FILE.test(file));
}

/**
 * Splits `tsc --pretty false` output into diagnostics: `{ file, code, lines }`, where `file` is a
 * repository-relative posix path, or null when the diagnostic has no location. Indented lines
 * continue the previous diagnostic. Anything else (usage text, crash output) is ignored here.
 */
export function parseDiagnostics(output, root = process.cwd()) {
  const diagnostics = [];
  for (const line of output.split(/\r?\n/)) {
    const located = LOCATED.exec(line);
    if (located) {
      let file = toPosix(located[1]);
      const absolute = resolve(root, located[1]);
      const rel = toPosix(relative(root, absolute));
      if (!rel.startsWith('../') && rel !== '') file = rel;
      diagnostics.push({ file, code: located[4], lines: [line] });
      continue;
    }
    const unlocated = UNLOCATED.exec(line);
    if (unlocated) {
      diagnostics.push({ file: null, code: unlocated[1], lines: [line] });
      continue;
    }
    if (diagnostics.length > 0 && /^\s+\S/.test(line)) {
      diagnostics[diagnostics.length - 1].lines.push(line);
    }
  }
  return diagnostics;
}

/**
 * Decides the outcome. `result` is what `spawnSync` returned for tsc.
 * Returns `{ exitCode, errors, warnings }`, each message a string ready to print.
 */
export function evaluate({ stagedFiles, result, root = process.cwd() }) {
  const staged = new Set([...stagedFiles].map(toPosix));
  const errors = [];
  const warnings = [];

  if (result.error) {
    errors.push(`typecheck-staged: tsc could not be run: ${result.error.message}`);
    return { exitCode: 1, errors, warnings };
  }
  if (result.status === null || result.status === undefined) {
    errors.push(
      `typecheck-staged: tsc did not exit normally (signal ${result.signal ?? 'unknown'}); nothing was checked`,
    );
    return { exitCode: 1, errors, warnings };
  }
  if (result.status === 0) return { exitCode: 0, errors, warnings };

  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  const diagnostics = parseDiagnostics(output, root);

  if (diagnostics.length === 0) {
    const tail = output.trim().split(/\r?\n/).slice(0, 5).join('\n');
    errors.push(
      `typecheck-staged: tsc exited with status ${result.status} but printed no readable diagnostic; nothing was checked${tail ? `\n${tail}` : ''}`,
    );
    return { exitCode: 1, errors, warnings };
  }

  const configProblems = diagnostics.filter((d) => d.file === null || /\.json$/i.test(d.file));
  const inStaged = diagnostics.filter(
    (d) => d.file !== null && !configProblems.includes(d) && staged.has(d.file),
  );
  const elsewhere = diagnostics.filter((d) => !configProblems.includes(d) && !inStaged.includes(d));

  if (configProblems.length > 0) {
    errors.push(
      `typecheck-staged: ${configProblems.length} configuration error(s); tsc could not type-check reliably:`,
    );
    for (const d of configProblems) errors.push(d.lines.join('\n'));
  }
  if (inStaged.length > 0) {
    errors.push(`typecheck-staged: ${inStaged.length} type error(s) in staged files:`);
    for (const d of inStaged) errors.push(d.lines.join('\n'));
  }
  if (elsewhere.length > 0) {
    warnings.push(
      `typecheck-staged: warning, ${elsewhere.length} diagnostic(s) outside the staged files (not blocking):`,
    );
    for (const d of elsewhere) warnings.push(d.lines.join('\n'));
  }
  return { exitCode: errors.length > 0 ? 1 : 0, errors, warnings };
}

export function main() {
  const root = process.cwd();
  const run = (command, args) =>
    spawnSync(command, args, { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });

  const list = run('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR']);
  if (list.error || list.status !== 0) {
    console.error(
      `typecheck-staged: could not list staged files\n${list.error?.message ?? list.stderr}`,
    );
    return 1;
  }
  const stagedFiles = list.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(toPosix);
  if (!shouldCheck(stagedFiles)) return 0;

  const tscBin = resolve(root, 'node_modules/typescript/bin/tsc');
  if (!existsSync(tscBin)) {
    console.error('typecheck-staged: typescript is not installed; run npm install');
    return 1;
  }
  const result = run(process.execPath, [tscBin, '--noEmit', '--pretty', 'false']);
  const outcome = evaluate({ stagedFiles, result, root });
  for (const message of outcome.warnings) console.warn(message);
  for (const message of outcome.errors) console.error(message);
  return outcome.exitCode;
}
