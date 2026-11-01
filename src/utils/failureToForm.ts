import type { FormInstance } from 'antd';
import { describeFailure } from '../session/describe';
import { isUploadIdRejection } from './uploadErrors';

/** The part of `useIntl()` this needs (Umi's copy of react-intl and ours have different types). */
type Translator = {
  messages: Record<string, unknown>;
  formatMessage: (descriptor: { id: string }, values?: Record<string, string | number>) => string;
};

type Options = {
  /**
   * A detail whose reason the language file does not know says "the input is not valid" (the text
   * of `INVALID_REQUEST`). Without it such a detail shows the reason code, or, when the failure
   * has just that one detail, the backend's own message.
   */
  generalReason?: boolean;
};

/**
 * Puts a failed save into the form: the text of each field detail goes under its field when the
 * form has it, and the whole text is returned for the bar at the bottom of the dialog. The words
 * are those of the error code and of the reasons, never the backend's own message (see `options`
 * for a reason the language file does not know). `uploadRejected` is true when the backend refused
 * the `uploadId` the request carried (the form must ask for the file again; call it for a request
 * that carries one). `aliases` maps a name the backend uses to the form field that holds it
 * (`linkTarget` to `link`). `unplaced` is the text of each detail that no field of the form took,
 * for the bar. `code` is the error code of the failure.
 */
export function failureToForm(
  intl: Translator,
  form: FormInstance,
  error: unknown,
  fields: readonly string[],
  aliases: Record<string, string> = {},
  options: Options = {},
): { text: string; uploadRejected: boolean; unplaced: string[]; code: string } {
  const { text, fields: details, error: failure } = describeFailure(intl, error);
  const general = intl.formatMessage({ id: 'error.INVALID_REQUEST' });
  const named = options.generalReason
    ? failure.details.map((detail) => ({
        ref: aliases[detail.ref] ?? detail.ref,
        text: intl.messages[`reason.${detail.reason}`]
          ? intl.formatMessage({ id: `reason.${detail.reason}` })
          : general,
      }))
    : details.map((d) => ({ ref: aliases[d.ref] ?? d.ref, text: d.text }));
  const mine = named.filter((d) => fields.includes(d.ref));
  if (mine.length > 0) form.setFields(mine.map((d) => ({ name: d.ref, errors: [d.text] })));
  return {
    text,
    uploadRejected: isUploadIdRejection(error),
    unplaced: named.filter((d) => !fields.includes(d.ref)).map((d) => d.text),
    code: failure.code,
  };
}
