import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { repoFiles } from '../../tests/noHardcodedText.scan';
import { drawsForm, revalidatePlacements, revalidateProblems } from '../../tests/revalidate.scan';

// Every form that has a check must take part in the language switch (`RevalidateOnLocaleChange`),
// or a message it shows stays in the old language. A form with no check at all is listed here with
// the reason, and the list is checked in both directions.
const NO_CHECK: Record<string, string> = {
  'src/pages/analytics/detail.tsx': 'filter fields with no rule',
  'src/pages/analytics/funnel.tsx': 'its problems are shown from keys kept in state, not by rules',
  'src/pages/campaign/LinkModal.tsx': 'fields with no rule, the text is built from keys',
  'src/pages/companionship/index.tsx': 'its problems are shown from state, not by rules',
  'src/pages/complaints/ComplaintDrawer.tsx': 'fields with no rule',
  'src/pages/invite/FissionTab.tsx': 'its problems are shown from keys kept in state, not by rules',
};

const CHECKS = /rules=|rules:|validator|linkRule|linkTargetRule/;

const sources = repoFiles().filter(
  (file) =>
    /^src\/.*\.tsx$/.test(file) &&
    !/\.test\.tsx$/.test(file) &&
    file !== 'src/hooks/useRevalidateOnLocaleChange.tsx',
);
const forms = sources.filter((file) => drawsForm(file, readFileSync(file, 'utf8')));

describe('forms and the language switch', () => {
  it('finds the forms', () => {
    expect(forms.length).toBeGreaterThan(40);
  });

  it('puts RevalidateOnLocaleChange, as code and inside the <Form>, in every form that has a check', () => {
    const problems = forms.flatMap((file) => {
      const text = readFileSync(file, 'utf8');
      return CHECKS.test(text) ? revalidateProblems(file, text) : [];
    });
    expect(problems).toEqual([]);
  });

  it('lists only forms that have no check, and every form listed exists', () => {
    for (const file of Object.keys(NO_CHECK)) {
      expect(forms, file).toContain(file);
      const text = readFileSync(file, 'utf8');
      expect(CHECKS.test(text), `${file}: ${NO_CHECK[file]}`).toBe(false);
      expect(revalidatePlacements(file, text), file).toEqual([]);
    }
    const unlisted = forms.filter((file) => !CHECKS.test(readFileSync(file, 'utf8')));
    expect(unlisted.filter((file) => !(file in NO_CHECK))).toEqual([]);
  });
});

describe('the scan of RevalidateOnLocaleChange', () => {
  const inForm = `
    export const A = () => (
      <Form form={form}>
        <RevalidateOnLocaleChange />
        <Form.Item name="a" rules={[{ required: true }]}><Input /></Form.Item>
      </Form>
    );`;

  it('accepts it inside a Form, also a ModalForm and a deeper place', () => {
    expect(revalidateProblems('a.tsx', inForm)).toEqual([]);
    expect(
      revalidateProblems(
        'a.tsx',
        '<ModalForm><div><RevalidateOnLocaleChange></RevalidateOnLocaleChange></div></ModalForm>',
      ),
    ).toEqual([]);
  });

  it('reports it moved out of the Form (the text is still in the file)', () => {
    const moved = `
      export const A = () => (
        <>
          <Form form={form}>
            <Form.Item name="a" rules={[{ required: true }]}><Input /></Form.Item>
          </Form>
          <RevalidateOnLocaleChange />
        </>
      );`;
    expect(moved).toContain('<RevalidateOnLocaleChange />');
    expect(revalidateProblems('a.tsx', moved)).toEqual([
      'a.tsx:7: <RevalidateOnLocaleChange /> is not inside a <Form>',
      'a.tsx: has a check but no <RevalidateOnLocaleChange /> inside a <Form>',
    ]);
  });

  it('reports it in another element beside the Form, not only in a fragment', () => {
    const beside = `
      export const A = () => (
        <div>
          <Form form={form}><Form.Item name="a" rules={[{ required: true }]} /></Form>
          <RevalidateOnLocaleChange />
        </div>
      );`;
    expect(revalidateProblems('a.tsx', beside)).toEqual([
      'a.tsx:5: <RevalidateOnLocaleChange /> is not inside a <Form>',
      'a.tsx: has a check but no <RevalidateOnLocaleChange /> inside a <Form>',
    ]);
  });

  it('reports one that is moved out even when another one is inside', () => {
    const both = `${inForm}\nexport const B = () => <RevalidateOnLocaleChange />;`;
    expect(revalidateProblems('a.tsx', both)).toEqual([
      'a.tsx:8: <RevalidateOnLocaleChange /> is not inside a <Form>',
    ]);
  });

  it('reports a file in which it is only in a comment or a string', () => {
    const commented = `
      // <RevalidateOnLocaleChange />
      /* <RevalidateOnLocaleChange /> */
      export const A = () => (
        <Form form={form}>
          {/* <RevalidateOnLocaleChange /> */}
          <Form.Item name="a" rules={[{ required: true }]}><Input title="<RevalidateOnLocaleChange />" /></Form.Item>
        </Form>
      );
      export const note = '<RevalidateOnLocaleChange />';`;
    expect(commented).toContain('<RevalidateOnLocaleChange />');
    expect(revalidatePlacements('a.tsx', commented)).toEqual([]);
    expect(revalidateProblems('a.tsx', commented)).toEqual([
      'a.tsx: has a check but no <RevalidateOnLocaleChange /> inside a <Form>',
    ]);
  });

  it('reports a file that has the check and does not have it at all', () => {
    const none = '<Form><Form.Item name="a" rules={[{ required: true }]} /></Form>';
    expect(revalidateProblems('a.tsx', none)).toEqual([
      'a.tsx: has a check but no <RevalidateOnLocaleChange /> inside a <Form>',
    ]);
  });

  it('knows which files draw a Form: the tag, not the word in a comment, a string or Form.Item alone', () => {
    expect(drawsForm('a.tsx', '<Form><Input /></Form>')).toBe(true);
    expect(drawsForm('a.tsx', '<Form form={f} />')).toBe(true);
    expect(drawsForm('a.tsx', '// <Form>\nconst s = "<Form>";')).toBe(false);
    expect(drawsForm('a.tsx', '<Form.Item name="a" />')).toBe(false);
  });
});
