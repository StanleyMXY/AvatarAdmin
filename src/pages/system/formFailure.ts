import type { FormInstance } from 'antd';
import { ApiError } from '../../request/errors';
import { describeFailure } from '../../session/describe';
import type { Translator } from '../../utils/displayText';
import { failureToForm as failureToSharedForm } from '../../utils/failureToForm';

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
  if (error instanceof ApiError && error.code === 'DUPLICATE_RESOURCE') {
    const { text } = describeFailure(intl, error);
    const field = (error.data as { field?: unknown } | null)?.field;
    if (typeof field === 'string' && fields.includes(field)) {
      form.setFields([{ name: field, errors: [text] }]);
      return { text: null, unplaced: [] };
    }
    return { text, unplaced: [] };
  }
  const { text, unplaced } = failureToSharedForm(
    intl,
    form,
    error,
    fields,
    {},
    { generalReason: true },
  );
  return { text, unplaced };
}
