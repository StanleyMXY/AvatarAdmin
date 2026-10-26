import type { FormInstance } from 'antd';
import { describeFailure } from '../../session/describe';
import { isUploadIdRejection } from '../../utils/uploadErrors';
import type { Translator } from './texts';

/**
 * Puts a failed save into the form: the text of each field detail goes under its field when the
 * form has it, and the whole text is returned for the bar at the bottom. `uploadRejected` is true
 * when the backend refused the `uploadId` the request carried: the form must ask for the file again.
 */
export function failureToForm(
  intl: Translator,
  form: FormInstance,
  error: unknown,
  fields: readonly string[],
): { text: string; uploadRejected: boolean } {
  const { text, fields: details } = describeFailure(intl, error);
  const mine = details.filter((d) => fields.includes(d.ref));
  if (mine.length > 0) form.setFields(mine.map((d) => ({ name: d.ref, errors: [d.text] })));
  return { text, uploadRejected: isUploadIdRejection(error) };
}
