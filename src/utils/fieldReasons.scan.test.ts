import { describe, expect, it } from 'vitest';
import { scanFieldReasons, scanSource } from '../../tests/fieldReasons.scan';

const scan = (source: string, file = 'page.tsx') => scanSource(file, source);

describe('the reasons under the fields follow the language', () => {
  it('every place that puts reasons under fields goes through setFieldReasons and sits in a form that rewrites them', () => {
    const { findings, callers } = scanFieldReasons('src');
    expect(findings).toEqual([]);
    // A guard against a scan that finds nothing: the dialogs that put reasons under fields.
    expect(callers.length).toBeGreaterThanOrEqual(30);
  });

  describe('the scan itself (a guard against a scan that finds nothing)', () => {
    it('sees a bare setFields, of any form', () => {
      expect(scan(`form.setFields([{ name: 'a', errors: [t('x')] }]);`)).toHaveLength(1);
      expect(scan(`(form as FormInstance).setFields(forForm);`)).toHaveLength(1);
      expect(scan(`ref.current?.setFields([]);`)).toHaveLength(1);
    });

    it('lets the mechanism itself call setFields', () => {
      expect(scan(`form.setFields(fields);`, 'src/utils/fieldReasons.ts')).toEqual([]);
    });

    it('sees a dialog that puts reasons under fields without rewriting them', () => {
      const found = scan(`
        function Dialog() {
          const go = () => failureToForm(intl, form, error, FIELDS);
          return <Form form={form}><Input /></Form>;
        }`);
      expect(found).toHaveLength(1);
      expect(found[0].problem).toMatch(/no <RevalidateOnLocaleChange/);
    });

    it('accepts the dialog whose form holds RevalidateOnLocaleChange (or the hook)', () => {
      expect(
        scan(`
          function Dialog() {
            const go = () => setFieldReasons(form, intl, reasons);
            return <Form form={form}><RevalidateOnLocaleChange /></Form>;
          }`),
      ).toEqual([]);
      expect(
        scan(`
          function Dialog() {
            useRevalidateOnLocaleChange(form);
            const go = () => failureToForm(intl, form, error, FIELDS);
          }`),
      ).toEqual([]);
    });

    it('sees a RevalidateOnLocaleChange outside a form, which rewrites nothing', () => {
      const found = scan(`
        function Dialog() {
          const go = () => failureToForm(intl, form, error, FIELDS);
          return <div><RevalidateOnLocaleChange /><Form form={form} /></div>;
        }`);
      expect(found.map((f) => f.problem)).toEqual([
        '<RevalidateOnLocaleChange /> is not inside a <Form>',
        'puts reasons under fields but no <RevalidateOnLocaleChange /> inside its <Form>',
      ]);
    });
  });
});
