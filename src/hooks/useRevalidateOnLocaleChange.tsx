import { useIntl } from '@umijs/max';
import { Form, type FormInstance } from 'antd';
import { useEffect, useRef } from 'react';
import { rewriteFieldReasons } from '../utils/fieldReasons';

/**
 * antd keeps the text of a message a form has already shown, so after the language is switched it
 * would stay in the old language until the field is checked again. This checks again, after the
 * switch, the fields that show a message right now: the form stays mounted, so nothing typed is
 * lost, and a field that shows no message is not marked.
 *
 * A reason put under a field by `setFieldReasons` (what the server refused, or a check the page made
 * after the save) is written again in the new language, from the failure it came from, as long as
 * the field still shows it as it was given; one the person has changed or cleared is forgotten. This
 * is why a form that shows such reasons must hold this: it is the only place that knows the language
 * was switched. Any other message that the rules of its field no longer produce is put back
 * unchanged: only a rule can be written again.
 */
export function useRevalidateOnLocaleChange(form: FormInstance) {
  const intl = useIntl();
  const { locale } = intl;
  const shown = useRef(locale);

  useEffect(() => {
    if (shown.current === locale) return;
    shown.current = locale;
    const given = rewriteFieldReasons(form, intl);
    const before = form
      .getFieldsError()
      .filter((field) => field.errors.length > 0 && !given.has(field.name.join('.')));
    if (before.length === 0) return;
    form
      .validateFields(before.map((field) => field.name))
      .catch(() => {})
      .then(() => {
        const passed = before.filter((field) => form.getFieldError(field.name).length === 0);
        if (passed.length > 0) form.setFields(passed.map(({ name, errors }) => ({ name, errors })));
      });
  }, [locale, form, intl]);
}

/**
 * The way a form takes part: put it inside `<Form>`. It is a child of the form so that it exists
 * only while the form is on screen (a dialog that is closed has no form to check, and asking an
 * unconnected form warns).
 */
export function RevalidateOnLocaleChange() {
  useRevalidateOnLocaleChange(Form.useFormInstance());
  return null;
}
