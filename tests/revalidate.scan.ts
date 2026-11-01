// The scanner behind src/hooks/revalidateCoverage.test.ts: where `<RevalidateOnLocaleChange />` is
// in a file, read from the syntax tree, so that a comment, a string or a place outside the `<Form>`
// does not count. (A form that has a check must hold it inside the `<Form>`: it reads the form of
// that context; outside it the messages the form shows stay in the language they were made in.)
import ts from 'typescript';

export type Placement = { line: number; inForm: boolean };

const TAG = 'RevalidateOnLocaleChange';

const tagOf = (node: ts.Node): string | undefined => {
  if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node))
    return node.tagName.getText();
  return undefined;
};

/** Is the node inside a JSX element whose tag is a form (`<Form>`, `<ModalForm>`, ...)? */
const insideForm = (node: ts.Node): boolean => {
  for (let up = node.parent; up; up = up.parent) {
    if (ts.isJsxElement(up) && /Form$/.test(up.openingElement.tagName.getText())) return true;
  }
  return false;
};

const parse = (file: string, source: string) =>
  ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

/** Every `<RevalidateOnLocaleChange />` that is code (not a comment or a string), and whether it is inside a form. */
export function revalidatePlacements(file: string, source: string): Placement[] {
  const sf = parse(file, source);
  const found: Placement[] = [];
  const visit = (node: ts.Node) => {
    if (tagOf(node) === TAG) {
      found.push({
        line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1,
        inForm: insideForm(node),
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

/** Does the file draw a `<Form>` (the antd one, by that name)? */
export function drawsForm(file: string, source: string): boolean {
  const sf = parse(file, source);
  let drawn = false;
  const visit = (node: ts.Node) => {
    if (tagOf(node) === 'Form') drawn = true;
    if (!drawn) ts.forEachChild(node, visit);
  };
  visit(sf);
  return drawn;
}

/** What is wrong with the way a file that has a check holds `<RevalidateOnLocaleChange />`; empty when nothing is. */
export function revalidateProblems(file: string, source: string): string[] {
  const placements = revalidatePlacements(file, source);
  const problems = placements
    .filter((p) => !p.inForm)
    .map((p) => `${file}:${p.line}: <${TAG} /> is not inside a <Form>`);
  if (!placements.some((p) => p.inForm)) {
    problems.push(`${file}: has a check but no <${TAG} /> inside a <Form>`);
  }
  return problems;
}
