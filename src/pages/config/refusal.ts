import type { ApiError } from '../../request/errors';
import type { describeFailure } from '../../session/describe';
import { plainText } from '../../utils/plainText';
import { specOf } from './configSchema';

type Translator = Parameters<typeof describeFailure>[0] & { locale: string };

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

const MAX_LISTED = 50;

/**
 * The keys whose refusal words are about the value of the key itself ("at least 1", "1 to 10080")
 * next to a rule they share with another key. When the other key was the one saved, these keys show
 * only their always-on rule hint, so that an unchanged value is not told it is wrong.
 */
const OWN_VALUE_WORDS = new Set([
  'push.schedule_catchup_minutes',
  'push.task_poll_seconds',
  'stats.land_window_days',
]);

/**
 * The words for the refusal of saving `push.default_locale` (400 with `data.defaultLocale`, the
 * language, and `data.reasons`, the recall reasons that have an enabled template but none in it).
 * Each reason is shown on its own, as plain text, in its own words when the language file has them;
 * without the language or the reasons the general rule is said instead. Null for any other reason.
 */
function defaultLocaleWords(intl: Translator, error: ApiError, reason: string): string | null {
  if (reason !== 'OUT_OF_RANGE') return null;
  const data = (error.data ?? {}) as { defaultLocale?: unknown; reasons?: unknown };
  const lang = typeof data.defaultLocale === 'string' ? data.defaultLocale.slice(0, 35) : '';
  const reasons = Array.isArray(data.reasons)
    ? data.reasons.slice(0, MAX_LISTED).map((entry) => {
        const code = plainText(entry);
        const id = `push.reason.${code}`;
        return intl.messages[id] ? intl.formatMessage({ id }) : code;
      })
    : [];
  const base = 'config.push.default_locale.reject.OUT_OF_RANGE';
  if (lang === '' || reasons.length === 0) return intl.formatMessage({ id: `${base}.general` });
  const list = (
    typeof Intl.ListFormat === 'function'
      ? new Intl.ListFormat(intl.locale, { style: 'narrow', type: 'conjunction' }).format(reasons)
      : reasons.join(', ')
  ) as string;
  return intl.formatMessage({ id: base }, { lang, reasons: list });
}

/**
 * The words of the saved row for the refusal as a whole (the part of the form that is not about a
 * field): the words of the error code, or the general words for a code the page has none for. The
 * backend's English message is never added, as the request layer does for other pages.
 */
export function refusalAlertText(intl: Translator, error: ApiError): string {
  const id = `error.${error.code}`;
  return intl.formatMessage({ id: intl.messages[id] ? id : 'error.UNKNOWN' });
}

export function refusalTexts(
  intl: Translator,
  error: ApiError,
  shown: ReadonlySet<string>,
  origin: string,
): RefusalTexts {
  const has = (id: string) => Boolean(intl.messages[id]);
  const rows = new Map<string, string>();
  const notKeys: string[] = [];
  const hiddenKeys: string[] = [];
  error.details.forEach((detail) => {
    const isKey = specOf(detail.ref) !== undefined;
    if (isKey && OWN_VALUE_WORDS.has(detail.ref) && detail.ref !== origin) return;
    const id = isKey
      ? `config.${detail.ref}.reject.${detail.reason}`
      : `config.refusal.${detail.ref}.${detail.reason}`;
    // The words of the key for the reason, else the general words of the reason, else the general
    // words for a reason the page does not know: never the backend's message, which is English.
    const general = has(`reason.${detail.reason}`)
      ? intl.formatMessage({ id: `reason.${detail.reason}` })
      : intl.formatMessage({ id: 'config.refusal.unknownReason' });
    let text =
      (detail.ref === 'push.default_locale'
        ? defaultLocaleWords(intl, error, detail.reason)
        : null) ?? (has(id) ? intl.formatMessage({ id }) : general);
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
