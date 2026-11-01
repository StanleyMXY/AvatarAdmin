import type { FormInstance } from 'antd';
import { describeFailure } from '../session/describe';
import { setFieldReasons } from './fieldReasons';
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
 * The words of a failed save, without touching a form: the whole text, the text of each field
 * detail (`named`), the ones that fall on a field of `fields` (`mine`) and the ones that do not
 * (`unplaced`). A page keeps the failure and calls this when it draws, so the words follow the
 * language; `failureToForm` is this plus putting `mine` under the fields of a form.
 */
export function failureWords(
  intl: Translator,
  error: unknown,
  fields: readonly string[],
  aliases: Record<string, string> = {},
  options: Options = {},
) {
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
  return {
    text,
    named,
    mine: named.filter((d) => fields.includes(d.ref)),
    unplaced: named.filter((d) => !fields.includes(d.ref)).map((d) => d.text),
    code: failure.code,
  };
}

/**
 * Puts a failed save into the form: the text of each field detail goes under its field when the
 * form has it, and the whole text is returned for the bar at the bottom of the dialog. The words
 * are those of the error code and of the reasons, never the backend's own message (see `options`
 * for a reason the language file does not know). `uploadRejected` is true when the backend refused
 * the `uploadId` the request carried (the form must ask for the file again; call it for a request
 * that carries one). `aliases` maps a name the backend uses to the form field that holds it
 * (`linkTarget` to `link`). `unplaced` is the text of each detail that no field of the form took,
 * for the bar. `code` is the error code of the failure. `text` and `unplaced` are in the language
 * of this moment: a page that keeps them in its state shows them in that language for good, so it
 * keeps the failure and calls `failureWords` when it draws. The words under the fields are written
 * again when the language is switched (`setFieldReasons`; the form holds `RevalidateOnLocaleChange`).
 */
export function failureToForm(
  intl: Translator,
  form: FormInstance,
  error: unknown,
  fields: readonly string[],
  aliases: Record<string, string> = {},
  options: Options = {},
): { text: string; uploadRejected: boolean; unplaced: string[]; code: string } {
  const { text, mine, unplaced, code } = failureWords(intl, error, fields, aliases, options);
  setFieldReasons(
    form,
    intl,
    mine.map((d, index) => ({
      name: d.ref,
      write: (other) =>
        failureWords(other, error, fields, aliases, options).mine[index]?.text ?? d.text,
    })),
  );
  return { text, uploadRejected: isUploadIdRejection(error), unplaced, code };
}
