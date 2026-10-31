import type { ApiError } from '../../request/errors';
import { describeFailure } from '../../session/describe';
import { specOf } from './configSchema';

type Translator = Parameters<typeof describeFailure>[0];

/**
 * The words for a save (or reset) the backend refused with `details`, in the language of the page.
 * They are built from the code of each detail, never from the backend's English message:
 *  - a detail whose `ref` is a setting key has its words in `config.<key>.reject.<reason>`, else the
 *    general words of the reason (`reason.<reason>`); a refusal that names two keys therefore
 *    appears on both rows;
 *  - a detail whose `ref` is not a setting key (`SmsTemplate`) has its words in
 *    `config.refusal.<ref>.<reason>`; they go to the top of the form.
 * Extra fields of `data` only add to the words; nothing depends on them.
 */
export type RefusalTexts = {
  /** The words for each row named by a detail. */
  rows: Map<string, string>;
  /** The words for details that name no row of the form. */
  top: string[];
};

const stringList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= 35)
    : [];

export function refusalTexts(
  intl: Translator,
  error: ApiError,
  shown: ReadonlySet<string>,
  origin: string,
): RefusalTexts {
  const { fields } = describeFailure(intl, error);
  const has = (id: string) => Boolean(intl.messages[id]);
  const rows = new Map<string, string>();
  const notKeys: string[] = [];
  const hiddenKeys: string[] = [];
  error.details.forEach((detail, index) => {
    const isKey = specOf(detail.ref) !== undefined;
    const id = isKey
      ? `config.${detail.ref}.reject.${detail.reason}`
      : `config.refusal.${detail.ref}.${detail.reason}`;
    let text = has(id) ? intl.formatMessage({ id }) : (fields[index]?.text ?? detail.reason);
    if (detail.ref === 'app.supported_locales') {
      const languages = stringList(
        (error.data as { missingLanguages?: unknown } | null)?.missingLanguages,
      );
      if (languages.length > 0)
        text = `${text} ${intl.formatMessage({ id: 'config.refusal.missingLanguages' }, { languages: languages.join(', ') })}`;
    }
    if (!isKey) notKeys.push(text);
    else if (shown.has(detail.ref)) {
      if (!rows.has(detail.ref)) rows.set(detail.ref, text);
    } else hiddenKeys.push(text);
  });
  // A key the form does not show is spoken for by the words of the row that was saved; only when
  // that row has none of its own do the words of the others go to the top.
  return { rows, top: rows.has(origin) ? notKeys : [...notKeys, ...hiddenKeys] };
}
