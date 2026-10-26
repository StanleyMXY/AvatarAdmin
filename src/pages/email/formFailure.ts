import type { FormInstance } from 'antd';
import { describeFailure } from '../../session/describe';
import type { Translator } from './texts';

/**
 * Puts a failed save into the form: the text of each field detail goes under its field when the
 * form has it, and the whole text is returned for the bar at the bottom of the dialog. The words are
 * those of the error code and of the reasons in the language file, never the backend's own message:
 * a detail whose reason the language file does not know says "the input is not valid" instead.
 */
export function failureToForm(
  intl: Translator,
  form: FormInstance,
  error: unknown,
  fields: readonly string[],
): { text: string; unplaced: string[] } {
  const { error: failure, text } = describeFailure(intl, error);
  const general = intl.formatMessage({ id: 'error.INVALID_REQUEST' });
  const named = failure.details.map((detail) => ({
    ref: detail.ref,
    text: intl.messages[`reason.${detail.reason}`]
      ? intl.formatMessage({ id: `reason.${detail.reason}` })
      : general,
  }));
  const mine = named.filter((d) => fields.includes(d.ref));
  if (mine.length > 0) form.setFields(mine.map((d) => ({ name: d.ref, errors: [d.text] })));
  return { text, unplaced: named.filter((d) => !fields.includes(d.ref)).map((d) => d.text) };
}
