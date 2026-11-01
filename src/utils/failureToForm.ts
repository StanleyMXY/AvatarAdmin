import type { FormInstance } from 'antd';
import { describeFailure } from '../session/describe';
import { isUploadIdRejection } from './uploadErrors';

/** The part of `useIntl()` this needs (Umi's copy of react-intl and ours have different types). */
type Translator = {
  messages: Record<string, unknown>;
  formatMessage: (descriptor: { id: string }, values?: Record<string, string | number>) => string;
};

/**
 * Puts a failed save into the form: the text of each field detail goes under its field when the
 * form has it, and the whole text is returned for the bar at the bottom of the dialog. The words
 * are those of the error code and of the reasons, never the backend's own message. `uploadRejected`
 * is true when the backend refused the `uploadId` the request carried (the form must ask for the
 * file again; call it for a request that carries one). `aliases` maps a name the backend uses to
 * the form field that holds it (`linkTarget` to `link`).
 */
export function failureToForm(
  intl: Translator,
  form: FormInstance,
  error: unknown,
  fields: readonly string[],
  aliases: Record<string, string> = {},
): { text: string; uploadRejected: boolean } {
  const { text, fields: details } = describeFailure(intl, error);
  const named = details.map((d) => ({ ref: aliases[d.ref] ?? d.ref, text: d.text }));
  const mine = named.filter((d) => fields.includes(d.ref));
  if (mine.length > 0) form.setFields(mine.map((d) => ({ name: d.ref, errors: [d.text] })));
  return { text, uploadRejected: isUploadIdRejection(error) };
}
