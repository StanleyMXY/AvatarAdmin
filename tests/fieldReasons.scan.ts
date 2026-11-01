// The scanner behind src/utils/fieldReasons.scan.test.ts: finds the places where a page puts words
// under the fields of a form in a way that the language switch cannot reach. antd keeps the words
// it is given, so a reason put there with a bare `form.setFields` stays in the language of that
// moment; `setFieldReasons` (and `failureToForm`, which calls it) keeps how to write the words
// again, and `RevalidateOnLocaleChange` inside the `<Form>` writes them when the language changes.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

export type Finding = { file: string; line: number; problem: string };

/** The files that are the mechanism (or a helper around it) and show no form themselves. */
export const MECHANISM = new Set([
  'src/utils/fieldReasons.ts',
  'src/hooks/useRevalidateOnLocaleChange.tsx',
]);
export const HELPERS = new Set(['src/utils/failureToForm.ts', 'src/pages/system/formFailure.ts']);

const PUTS = new Set(['failureToForm', 'setFieldReasons']);

const calleeName = (call: ts.CallExpression): string | undefined => {
  const e = call.expression;
  if (ts.isIdentifier(e)) return e.text;
  if (ts.isPropertyAccessExpression(e)) return e.name.text;
  return undefined;
};

/** Is the node inside a JSX element whose tag is a form (`<Form>`, `<ModalForm>`, ...)? */
const insideForm = (node: ts.Node): boolean => {
  for (let up = node.parent; up; up = up.parent) {
    if (ts.isJsxElement(up) && /Form$/.test(up.openingElement.tagName.getText())) return true;
  }
  return false;
};

export function scanSource(file: string, source: string): Finding[] {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const findings: Finding[] = [];
  const at = (node: ts.Node) => sf.getLineAndCharacterOfPosition(node.getStart()).line + 1;
  let puts: number | undefined;
  let holds = false;
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const name = calleeName(node);
      if (name === 'setFields' && ts.isPropertyAccessExpression(node.expression)) {
        if (!MECHANISM.has(file)) {
          findings.push({
            file,
            line: at(node),
            problem:
              'a bare setFields keeps words in the language of the moment: use setFieldReasons',
          });
        }
      }
      if (name && PUTS.has(name) && !HELPERS.has(file) && !MECHANISM.has(file)) puts ??= at(node);
      if (name === 'useRevalidateOnLocaleChange') holds = true;
    }
    if (
      (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) &&
      node.tagName.getText() === 'RevalidateOnLocaleChange'
    ) {
      if (insideForm(node)) holds = true;
      else {
        findings.push({
          file,
          line: at(node),
          problem: '<RevalidateOnLocaleChange /> is not inside a <Form>',
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  if (puts !== undefined && !holds) {
    findings.push({
      file,
      line: puts,
      problem: 'puts reasons under fields but no <RevalidateOnLocaleChange /> inside its <Form>',
    });
  }
  return findings;
}

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name.startsWith('.') ? [] : sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\./.test(entry.name) ? [path] : [];
  });

/** Every place under `dir` where reasons under fields would stay in the language they were written in. */
export function scanFieldReasons(dir: string): { findings: Finding[]; callers: string[] } {
  const findings: Finding[] = [];
  const callers: string[] = [];
  for (const path of sourceFiles(dir)) {
    const file = path.replaceAll('\\', '/');
    const source = readFileSync(path, 'utf8');
    findings.push(...scanSource(file, source));
    if (
      !HELPERS.has(file) &&
      !MECHANISM.has(file) &&
      /\b(failureToForm|setFieldReasons)\(/.test(source)
    ) {
      callers.push(file);
    }
  }
  return { findings, callers };
}
