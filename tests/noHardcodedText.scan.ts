// The scanners behind tests/noHardcodedText.test.ts.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

export type Finding = { file: string; line: number; text: string };

/** Props whose value is shown to a person. */
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
]);

/** A letter of any script (Latin, Thai, Arabic, CJK, ...): symbols, digits and punctuation alone are not text. */
const hasLetter = (s: string) => /\p{L}/u.test(s);

function stringLiterals(node: ts.Node): ts.StringLiteralLike[] {
  if (ts.isStringLiteralLike(node)) return [node];
  if (ts.isParenthesizedExpression(node)) return stringLiterals(node.expression);
  if (ts.isConditionalExpression(node))
    return [...stringLiterals(node.whenTrue), ...stringLiterals(node.whenFalse)];
  if (ts.isBinaryExpression(node))
    return [...stringLiterals(node.left), ...stringLiterals(node.right)];
  if (ts.isTemplateExpression(node))
    return [ts.factory.createStringLiteral(node.head.text) as ts.StringLiteralLike];
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
  const report = (node: ts.Node, value: string) => {
    const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
    findings.push({ file: fileName, line: line + 1, text: value.trim() });
  };
  const check = (node: ts.Node, value: string) => {
    if (hasLetter(value)) report(node, value);
  };

  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) {
      check(node, node.text);
    } else if (
      ts.isJsxAttribute(node) &&
      TEXT_PROPS.has(node.name.getText(source)) &&
      node.initializer
    ) {
      const init = node.initializer;
      const expression = ts.isJsxExpression(init) ? init.expression : init;
      if (expression)
        for (const literal of stringLiterals(expression)) check(literal, literal.text);
    } else if (
      ts.isJsxExpression(node) &&
      node.parent &&
      (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent)) &&
      node.expression
    ) {
      for (const literal of stringLiterals(node.expression)) check(literal, literal.text);
    } else if (ts.isPropertyAssignment(node) && node.name.getText(source) === 'defaultMessage') {
      for (const literal of stringLiterals(node.initializer)) check(literal, literal.text);
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
    .filter(Boolean);
}

const TEXT_EXTENSIONS =
  /\.(ts|tsx|js|jsx|mjs|cjs|json|md|css|less|svg|html|yml|yaml|txt|example|hbs)$/;

export const isTextFile = (file: string) =>
  TEXT_EXTENSIONS.test(file) && !file.endsWith('package-lock.json');

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
