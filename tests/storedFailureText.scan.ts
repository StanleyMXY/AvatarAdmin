// The scanner behind src/session/storedFailureText.test.ts: finds the places where a page puts the
// words of a failure, made in the language of that moment, into its state. The words stay in that
// language when the language is switched; a page keeps the failure itself (or `useFailure`, which
// does) and makes the words when it draws.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

export type Finding = { file: string; line: number; setter: string };

/**
 * The functions that turn a failure into words in the current language. A call to one of them (or
 * a name that holds its result) must not be an argument of the setter of a `useState`.
 */
export const WORD_MAKERS = new Set([
  'describeFailure',
  'describeError',
  'failureToForm',
  'failureLine',
  'failureLines',
  'noticeText',
  'actionFailure',
  'templateFailureText',
  'guardedFailureText',
  'protectedFailureText',
  'withScopeHint',
  'chainFailureText',
  'defaultAvatarFailure',
]);

/**
 * A state whose name says it holds a problem (`languageProblem`, `failure`, `serverErrors`) must not
 * be given words from the language file either (`setProblem(t('x'))`): it keeps the key of the
 * words, or the failure, and the page makes the words when it draws.
 */
const PROBLEM_STATE = /problem|failure|error|refus|reject/i;
const TRANSLATOR_CALLS = new Set(['t', 'formatMessage']);

const callsTranslator = (node: ts.Node): boolean => {
  let found = false;
  const visit = (child: ts.Node) => {
    if (found) return;
    // A function inside the argument is a recipe, not words: it runs when the page is drawn.
    if (ts.isArrowFunction(child) || ts.isFunctionExpression(child)) return;
    if (ts.isCallExpression(child) && TRANSLATOR_CALLS.has(calleeName(child) ?? '')) {
      found = true;
      return;
    }
    ts.forEachChild(child, visit);
  };
  visit(node);
  return found;
};

/** What a maker's result holds that is not words: reading these is fine. */
const NOT_WORDS = new Set(['code', 'error', 'uploadRejected']);

const STATE_HOOKS = new Set(['useState', 'useReducer']);

const calleeName = (call: ts.CallExpression): string | undefined => {
  const callee = call.expression;
  if (ts.isIdentifier(callee)) return callee.text;
  if (ts.isPropertyAccessExpression(callee)) return callee.name.text;
  return undefined;
};

/** The names a binding pattern declares (`{ text, fields: f }` gives text and f). */
function boundNames(name: ts.BindingName, skipNotWords: boolean): string[] {
  if (ts.isIdentifier(name)) return [name.text];
  const names: string[] = [];
  for (const element of name.elements) {
    if (ts.isOmittedExpression(element)) continue;
    const property =
      !ts.isArrayBindingPattern(name) && element.propertyName
        ? element.propertyName.getText()
        : ts.isIdentifier(element.name)
          ? element.name.text
          : '';
    if (skipNotWords && NOT_WORDS.has(property)) continue;
    names.push(...boundNames(element.name, skipNotWords));
  }
  return names;
}

/** Whether the words of a failure are in this expression: a maker's call, or a name that holds them. */
function holdsWords(node: ts.Node, tainted: Set<string>, makers: Set<string>): boolean {
  let found = false;
  const visit = (child: ts.Node) => {
    if (found) return;
    if (ts.isCallExpression(child)) {
      const name = calleeName(child);
      if (name && makers.has(name)) {
        // `describeFailure(...).code` and the like are not words.
        const parent = child.parent;
        if (ts.isPropertyAccessExpression(parent) && NOT_WORDS.has(parent.name.text)) return;
        found = true;
        return;
      }
    }
    if (ts.isPropertyAccessExpression(child) && NOT_WORDS.has(child.name.text)) {
      // `result.code`: not words, whatever `result` holds.
      return;
    }
    if (ts.isIdentifier(child) && tainted.has(child.text)) {
      const parent = child.parent;
      // The name of a property (`x.text` has the name `text`) or of an object key is not a use.
      if (ts.isPropertyAccessExpression(parent) && parent.name === child) return;
      if (ts.isPropertyAssignment(parent) && parent.name === child) return;
      found = true;
      return;
    }
    ts.forEachChild(child, visit);
  };
  visit(node);
  return found;
}

export function scanSource(file: string, source: string): Finding[] {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const setters = new Set<string>();
  const tainted = new Set<string>();
  // The makers of the list, and the functions of this file that return words made by one of them
  // (`function failureText(error) { return describeFailure(intl, error).text; }`).
  const makers = new Set(WORD_MAKERS);

  // The setters of the page's state.
  const collectSetters = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isArrayBindingPattern(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      STATE_HOOKS.has(calleeName(node.initializer) ?? '')
    ) {
      const second = node.name.elements[1];
      if (second && !ts.isOmittedExpression(second) && ts.isIdentifier(second.name)) {
        setters.add(second.name.text);
      }
    }
    ts.forEachChild(node, collectSetters);
  };
  collectSetters(sf);

  const returnedExpressions = (fn: ts.FunctionLikeDeclaration): ts.Expression[] => {
    if (!fn.body) return [];
    if (!ts.isBlock(fn.body)) return [fn.body];
    const found: ts.Expression[] = [];
    const visit = (node: ts.Node) => {
      // A function inside this one returns for itself.
      if (node !== fn.body && ts.isFunctionLike(node)) return;
      if (ts.isReturnStatement(node) && node.expression) found.push(node.expression);
      ts.forEachChild(node, visit);
    };
    visit(fn.body);
    return found;
  };
  const localFunctions: { name: string; fn: ts.FunctionLikeDeclaration }[] = [];
  const collectFunctions = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name) {
      localFunctions.push({ name: node.name.text, fn: node });
    } else if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
    ) {
      localFunctions.push({ name: node.name.text, fn: node.initializer });
    }
    ts.forEachChild(node, collectFunctions);
  };
  collectFunctions(sf);
  let more = true;
  while (more) {
    more = false;
    for (const { name, fn } of localFunctions) {
      // A component or a hook returns elements or state, not words.
      if (makers.has(name) || /^(use|[A-Z])/.test(name)) continue;
      const words = returnedExpressions(fn).some(
        (expression) =>
          !ts.isObjectLiteralExpression(expression) &&
          !ts.isArrayLiteralExpression(expression) &&
          !ts.isArrowFunction(expression) &&
          holdsWords(expression, new Set(), makers),
      );
      if (words) {
        makers.add(name);
        more = true;
      }
    }
  }

  // The names that hold words, found again until nothing new is found (`const text = described.text`).
  let grew = true;
  while (grew) {
    grew = false;
    const collect = (node: ts.Node) => {
      // A function that makes words (`const wordsOf = (e) => (intl) => describeFailure(...)`) is not words.
      if (
        ts.isVariableDeclaration(node) &&
        node.initializer &&
        !ts.isArrowFunction(node.initializer) &&
        !ts.isFunctionExpression(node.initializer)
      ) {
        const names = boundNames(node.name, true);
        if (names.some((n) => !tainted.has(n)) && holdsWords(node.initializer, tainted, makers)) {
          for (const n of names) {
            if (!tainted.has(n)) {
              tainted.add(n);
              grew = true;
            }
          }
        }
      }
      ts.forEachChild(node, collect);
    };
    collect(sf);
  }

  const findings: Finding[] = [];
  const check = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const name = node.expression.text;
      if (
        setters.has(name) &&
        node.arguments.some(
          (arg) =>
            holdsWords(arg, tainted, makers) || (PROBLEM_STATE.test(name) && callsTranslator(arg)),
        )
      ) {
        const { line } = sf.getLineAndCharacterOfPosition(node.getStart());
        findings.push({ file, line: line + 1, setter: name });
      }
    }
    ts.forEachChild(node, check);
  };
  check(sf);
  return findings;
}

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name.startsWith('.') ? [] : sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\./.test(entry.name) ? [path] : [];
  });

/** Every place under `dir` that keeps the words of a failure in the state of a page. */
export function scanStoredFailureText(dir: string): Finding[] {
  return sourceFiles(dir).flatMap((file) =>
    scanSource(file.replaceAll('\\', '/'), readFileSync(file, 'utf8')),
  );
}
