import type { FormInstance } from 'antd';
import { describeFailure } from '../../session/describe';
import type { Translator } from './texts';

/**
 * Puts a failed save into the form: the text of each field detail goes under its field when the form
 * has it, and the text of the failure is returned for the bar at the bottom of the dialog. The words
 * are those of the language file for the error code and the reason; the backend's own message is not shown.
 */
export function failureToForm(
  intl: Translator,
  form: FormInstance,
  error: unknown,
  fields: readonly string[],
): { text: string; code: string } {
  const { text, fields: details, error: failure } = describeFailure(intl, error);
  const mine = details.filter((d) => fields.includes(d.ref));
  if (mine.length > 0) form.setFields(mine.map((d) => ({ name: d.ref, errors: [d.text] })));
  return { text, code: failure.code };
}
