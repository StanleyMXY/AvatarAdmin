import type { FormInstance } from 'antd';
import { describeFailure } from '../../session/describe';
import type { Translator } from './texts';

/**
 * Puts a failed save into the form: the text of each field detail goes under its field when the
 * form has it, and the whole text is returned for the bar at the bottom of the dialog. The words
 * are those of the error code and of the reasons, never the backend's own message.
 */
export function failureToForm(
  intl: Translator,
  form: FormInstance,
  error: unknown,
  fields: readonly string[],
): string {
  const { text, fields: details } = describeFailure(intl, error);
  const mine = details.filter((d) => fields.includes(d.ref));
  if (mine.length > 0) form.setFields(mine.map((d) => ({ name: d.ref, errors: [d.text] })));
  return text;
}
