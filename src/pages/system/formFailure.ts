import type { FormInstance } from 'antd';
import { describeFailure } from '../../session/describe';
import type { Translator } from './texts';

/**
 * Puts a failed save into the form. Field details (400 `INVALID_REQUEST`) go under their field when
 * the form has it, and a duplicate (409 `DUPLICATE_RESOURCE`) goes under the field `data.field`
 * names. The words are those of the error code and of the reasons in the language file, never the
 * backend's own message: a detail whose reason the file does not know says "the input is not valid".
 * Returns the text for the bar at the bottom of the dialog, or null when a duplicate was placed under
 * its field.
 */
export function failureToForm(
  intl: Translator,
  form: FormInstance,
  error: unknown,
  fields: readonly string[],
): { text: string | null; unplaced: string[] } {
  const { error: failure, text } = describeFailure(intl, error);
  if (failure.code === 'DUPLICATE_RESOURCE') {
    const field = (failure.data as { field?: unknown } | null)?.field;
    if (typeof field === 'string' && fields.includes(field)) {
      form.setFields([{ name: field, errors: [text] }]);
      return { text: null, unplaced: [] };
    }
    return { text, unplaced: [] };
  }
  const general = intl.formatMessage({ id: 'error.INVALID_REQUEST' });
  const named = failure.details.map((detail) => ({
    ref: detail.ref,
    text: intl.messages[`reason.${detail.reason}`]
      ? intl.formatMessage({ id: `reason.${detail.reason}` })
      : general,
  }));
  const mine = named.filter((d) => fields.includes(d.ref));
  if (mine.length > 0) form.setFields(mine.map((d) => ({ name: d.ref, errors: [d.text] })));
  const unplaced = named.filter((d) => !fields.includes(d.ref)).map((d) => d.text);
  return { text, unplaced };
}
