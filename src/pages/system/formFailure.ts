import type { FormInstance } from 'antd';
import { ApiError } from '../../request/errors';
import { describeFailure } from '../../session/describe';
import type { Translator } from '../../utils/displayText';
import { failureToForm as failureToSharedForm, failureWords } from '../../utils/failureToForm';
import { failureReason, setFieldReasons } from '../../utils/fieldReasons';

/**
 * The words of a failed save, without a form: the text for the bar at the bottom of the dialog (null
 * when a duplicate lands under its own field) and the details no field took. A page keeps the failure
 * and calls this when it draws, so the words follow the language.
 */
export function failureView(
  intl: Translator,
  error: unknown,
  fields: readonly string[],
): { text: string | null; unplaced: string[] } {
  if (error instanceof ApiError && error.code === 'DUPLICATE_RESOURCE') {
    const { text } = describeFailure(intl, error);
    const field = (error.data as { field?: unknown } | null)?.field;
    if (typeof field === 'string' && fields.includes(field)) return { text: null, unplaced: [] };
    return { text, unplaced: [] };
  }
  const { text, unplaced } = failureWords(intl, error, fields, {}, { generalReason: true });
  return { text, unplaced };
}

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
    const field = (error.data as { field?: unknown } | null)?.field;
    if (typeof field === 'string' && fields.includes(field)) {
      setFieldReasons(form, intl, [failureReason(field, error)]);
    }
    return failureView(intl, error, fields);
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
