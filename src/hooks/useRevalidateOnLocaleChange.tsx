import { useIntl } from '@umijs/max';
import { Form, type FormInstance } from 'antd';
import { useEffect, useRef } from 'react';

/**
 * antd keeps the text of a message a form has already shown, so after the language is switched it
 * would stay in the old language until the field is checked again. This checks again, after the
 * switch, the fields that show a message right now: the form stays mounted, so nothing typed is
 * lost, and a field that shows no message is not marked.
 *
 * A message that the rules of its field no longer produce (it was put there with `setFields`, for
 * example a reason the server gave) is put back unchanged: only a rule can be written again.
 */
export function useRevalidateOnLocaleChange(form: FormInstance) {
  const { locale } = useIntl();
  const shown = useRef(locale);

  useEffect(() => {
    if (shown.current === locale) return;
    shown.current = locale;
    const before = form.getFieldsError().filter((field) => field.errors.length > 0);
    if (before.length === 0) return;
    form
      .validateFields(before.map((field) => field.name))
      .catch(() => {})
      .then(() => {
        const passed = before.filter((field) => form.getFieldError(field.name).length === 0);
        if (passed.length > 0) form.setFields(passed.map(({ name, errors }) => ({ name, errors })));
      });
  }, [locale, form]);
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
