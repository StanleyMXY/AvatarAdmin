import type { FormInstance } from 'antd';
import { describeFailure, type Translator } from '../session/describe';

/**
 * A reason put under a field of a form: the field and the way to write the words, in the language
 * of the translator it is given. antd keeps the words it was given (`setFields`), so a form that was
 * given the words of one language shows them for good; keeping the way to write them lets the
 * words be written again when the language is switched (`RevalidateOnLocaleChange` does that).
 */
export type FieldReason = { name: string; write: (intl: Translator) => string };

type Kept = { shown: string; write: FieldReason['write'] };

/** Per form: the reasons it was given and still shows, by field. Gone with the form. */
const kept = new WeakMap<FormInstance, Map<string, Kept>>();

/**
 * Puts reasons under the fields of a form, in the language of `intl`, and keeps how to write them
 * again. This is the only way a page puts words that come from a failure, or from its own check
 * after a save, under a field; a scan test refuses a bare `form.setFields` anywhere else. A later
 * reason for the same field wins, as it does in `setFields`.
 */
export function setFieldReasons(form: FormInstance, intl: Translator, reasons: FieldReason[]) {
  const last = new Map<string, FieldReason>();
  for (const reason of reasons) last.set(reason.name, reason);
  if (last.size === 0) return;
  const fields = [...last.values()].map(({ name, write }) => ({ name, errors: [write(intl)] }));
  form.setFields(fields);
  const map = kept.get(form) ?? new Map<string, Kept>();
  kept.set(form, map);
  for (const [i, reason] of [...last.values()].entries()) {
    map.set(reason.name, { shown: fields[i].errors[0], write: reason.write });
  }
}

/**
 * After the language was switched: writes again, in the language of `intl`, each reason the form
 * still shows exactly as it was given, and returns the names of those fields. A reason the person
 * has since changed or cleared (the field was edited, the form was submitted again, the form was
 * reset) is no longer shown, so it is forgotten and never comes back.
 */
export function rewriteFieldReasons(form: FormInstance, intl: Translator): Set<string> {
  const rewritten = new Set<string>();
  const map = kept.get(form);
  if (!map) return rewritten;
  const fields: { name: string; errors: string[] }[] = [];
  for (const [name, entry] of map) {
    const now = form.getFieldError(name);
    if (now.length !== 1 || now[0] !== entry.shown) {
      map.delete(name);
      continue;
    }
    const text = entry.write(intl);
    fields.push({ name, errors: [text] });
    map.set(name, { shown: text, write: entry.write });
    rewritten.add(name);
  }
  if (fields.length > 0) form.setFields(fields);
  return rewritten;
}

/**
 * The reasons of the field details of a failure (the texts `describeFailure` makes for a 400's
 * `details`), for the details that `place` gives a field of the form (undefined: not for this
 * form). Each is written again from the failure, not kept as words.
 */
export function detailReasons(
  intl: Translator,
  error: unknown,
  place: (ref: string) => string | undefined,
): FieldReason[] {
  const reasons: FieldReason[] = [];
  for (const [index, detail] of describeFailure(intl, error).fields.entries()) {
    const name = place(detail.ref);
    if (name !== undefined) reasons.push(detailReason(intl, error, name, index));
  }
  return reasons;
}

/** The reason of the `index`th field detail of a failure under the field `name`. */
export function detailReason(
  intl: Translator,
  error: unknown,
  name: string,
  index: number,
): FieldReason {
  const first = describeFailure(intl, error).fields[index]?.text ?? '';
  return {
    name,
    write: (other) => describeFailure(other, error).fields[index]?.text ?? first,
  };
}

/** The reason that is the text of the whole failure (a duplicate under the field it names). */
export const failureReason = (name: string, error: unknown): FieldReason => ({
  name,
  write: (intl) => describeFailure(intl, error).text,
});

/** The reason that is a text of the language file (a check the page made itself). */
export const messageReason = (name: string, id: string): FieldReason => ({
  name,
  write: (intl) => intl.formatMessage({ id }),
});
