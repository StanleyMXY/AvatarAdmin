// The scanners behind tests/noHardcodedText.test.ts.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import ts from 'typescript';

export type Finding = { file: string; line: number; text: string };

/** Names whose value is shown to a person, as a JSX prop or as the key of an object (table columns, options, menu items, dialogs). */
const TEXT_PROPS = new Set([
  'title',
  'label',
  'placeholder',
  'content',
  'message',
  'description',
  'okText',
  'cancelText',
  'alt',
  'aria-label',
  'tooltip',
  'extra',
  'header',
  'text',
  'help',
  'emptyText',
  'tip',
  'subTitle',
  'addonBefore',
  'addonAfter',
  'prefix',
  'suffix',
  'checkedChildren',
  'unCheckedChildren',
  'defaultMessage',
]);

/** Calls whose string arguments are shown to a person: `message.error('...')`, `Modal.confirm(...)`. */
const TEXT_CALL_OBJECTS = new Set(['message', 'notification']);

/** A letter of any script (Latin, Thai, Arabic, CJK, ...): symbols, digits and punctuation alone are not text. */
const hasLetter = (s: string) => /\p{L}/u.test(s);

type Literal = { node: ts.Node; text: string };

/** The string literals an expression can show: both sides of a condition, the text parts of a template, through `as`, parentheses and String(...). */
function literalsOf(node: ts.Node): Literal[] {
  if (ts.isStringLiteralLike(node)) return [{ node, text: node.text }];
  if (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isNonNullExpression(node) ||
    ts.isTypeAssertionExpression(node) ||
    ts.isSatisfiesExpression(node)
  ) {
    return literalsOf(node.expression);
  }
  if (ts.isConditionalExpression(node))
    return [...literalsOf(node.whenTrue), ...literalsOf(node.whenFalse)];
  if (ts.isBinaryExpression(node)) return [...literalsOf(node.left), ...literalsOf(node.right)];
  if (ts.isTemplateExpression(node)) {
    return [
      { node: node.head, text: node.head.text },
      ...node.templateSpans.map((span) => ({ node: span.literal, text: span.literal.text })),
    ];
  }
  if (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === 'String'
  ) {
    return node.arguments.flatMap(literalsOf);
  }
  return [];
}

/** String literals in a .tsx file that a person would read and that do not come from a language file. */
export function scanSource(fileName: string, text: string): Finding[] {
  const source = ts.createSourceFile(
    fileName,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const findings: Finding[] = [];
  const check = (literals: Literal[]) => {
    for (const { node, text: value } of literals) {
      if (!hasLetter(value)) continue;
      const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
      findings.push({ file: fileName, line: line + 1, text: value.trim() });
    }
  };
  const nameOf = (name: ts.PropertyName) =>
    ts.isIdentifier(name) || ts.isStringLiteralLike(name) ? name.text : undefined;

  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) {
      check([{ node, text: node.text }]);
    } else if (
      ts.isJsxAttribute(node) &&
      TEXT_PROPS.has(node.name.getText(source)) &&
      node.initializer
    ) {
      const init = node.initializer;
      const expression = ts.isJsxExpression(init) ? init.expression : init;
      if (expression) check(literalsOf(expression));
    } else if (
      ts.isJsxExpression(node) &&
      node.parent &&
      (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent)) &&
      node.expression
    ) {
      check(literalsOf(node.expression));
    } else if (ts.isPropertyAssignment(node)) {
      const key = nameOf(node.name);
      if (key !== undefined && TEXT_PROPS.has(key)) check(literalsOf(node.initializer));
    } else if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      TEXT_CALL_OBJECTS.has(node.expression.expression.text)
    ) {
      check(node.arguments.flatMap(literalsOf));
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return findings;
}

export type AllowEntry = { file: string; text: string; reason: string };

export function applyAllowList(
  findings: Finding[],
  allow: AllowEntry[],
): { remaining: Finding[]; unused: AllowEntry[] } {
  const used = new Set<AllowEntry>();
  const remaining = findings.filter((finding) => {
    const entry = allow.find((a) => a.file === finding.file && a.text === finding.text);
    if (entry) used.add(entry);
    return !entry;
  });
  return { remaining, unused: allow.filter((a) => !used.has(a)) };
}

/** The files of the working tree that git tracks or would track (so node_modules, dist and .umi are out). */
export function repoFiles(): string[] {
  return execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
    .split('\n')
    .filter((file) => file !== '')
    .filter(isPresent);
}

/** git lists a file that was deleted but not yet staged; there is nothing to read there. */
export const isPresent = (file: string) => existsSync(file);

const TEXT_EXTENSIONS =
  /\.(ts|tsx|js|jsx|mjs|cjs|json|md|css|less|svg|html|yml|yaml|txt|example|hbs)$/;

/** Source and text files, and the dot files (.npmrc, .lintstagedrc, .husky/*) that have no extension. */
export const isTextFile = (file: string) => {
  if (file.endsWith('package-lock.json')) return false;
  const name = file.slice(file.lastIndexOf('/') + 1);
  return TEXT_EXTENSIONS.test(file) || name.startsWith('.') || file.startsWith('.husky/');
};

const ALLOW_FILE = 'tests/noHardcodedText.allow.json';
const MODULE_ALLOW_FILE = /(^|\/)hardcodedText\.allow\.json$/;

/** The allow list: the shared file and, for module tasks, a `hardcodedText.allow.json` next to their own pages. */
export function readAllowList(files: string[]): AllowEntry[] {
  return files
    .filter((file) => file === ALLOW_FILE || MODULE_ALLOW_FILE.test(file))
    .flatMap((file) => JSON.parse(readFileSync(file, 'utf8')) as AllowEntry[]);
}

export const readText = (file: string): string | undefined => {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return undefined;
  }
};

export type PatternRule = {
  name: string;
  pattern: RegExp;
  /** Files (by path) the rule does not apply to. */
  skip: (file: string) => boolean;
  /** Lines the rule does not apply to (for example the `$schema` address of a JSON file, which names a document and is never loaded). */
  skipLine?: RegExp;
};

export function scanPatterns(files: string[], rules: PatternRule[]): Finding[] {
  const findings: Finding[] = [];
  for (const file of files.filter(isTextFile)) {
    const text = readText(file);
    if (text === undefined) continue;
    const lines = text.split('\n');
    for (const rule of rules) {
      if (rule.skip(file)) continue;
      lines.forEach((line, index) => {
        if (rule.skipLine?.test(line)) return;
        const match = rule.pattern.exec(line);
        if (match) findings.push({ file, line: index + 1, text: `${rule.name}: ${match[0]}` });
      });
    }
  }
  return findings;
}
