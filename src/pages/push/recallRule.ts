import { ApiError } from '../../request/errors';
import { describeFailure } from '../../session/describe';
import { plainText } from '../../utils/plainText';
import { codeText, type Translator } from './texts';

/** What the backend names when it refuses a template write for the rule of the default language. */
export type RecallRule = { defaultLocale: string; reason: string };

/**
 * The data of the refusal of contract 8.4 (400 INVALID_REQUEST with `data` `{defaultLocale, reason}`):
 * a recall reason with an enabled template must have an enabled template in the default language.
 * Null for any other failure. The answer of saving `push.default_locale` is not this one: it has
 * `reasons`, and belongs to the settings page.
 */
export function recallRuleOf(error: unknown): RecallRule | null {
  if (!(error instanceof ApiError) || error.code !== 'INVALID_REQUEST') return null;
  const data = error.data;
  if (typeof data !== 'object' || data === null) return null;
  const { defaultLocale, reason } = data as { defaultLocale?: unknown; reason?: unknown };
  if (typeof defaultLocale !== 'string' || defaultLocale === '') return null;
  if (typeof reason !== 'string' || reason === '') return null;
  return { defaultLocale, reason };
}

/**
 * The words of the error code and, when the backend names what is wrong (`details`), the words of
 * each reason the page has words for, once each. A reason without words is left out: the backend's
 * own sentence is never shown.
 */
function withReasons(intl: Translator, error: unknown): string {
  const text = describeFailure(intl, error).text;
  if (!(error instanceof ApiError)) return text;
  const reasons = [
    ...new Set(
      error.details
        .map((detail) => `reason.${detail.reason}`)
        .filter((key) => Object.hasOwn(intl.messages, key))
        .map((key) => intl.formatMessage({ id: key })),
    ),
  ];
  return reasons.length === 0 ? text : `${text} (${reasons.join(' ')})`;
}

/**
 * The words of a failed template write. The backend has three messages for this refusal that data
 * cannot tell apart, so one text says what is true in each: the reason needs an enabled template in
 * the default language; enable or keep it first, then change the other languages. The backend's own
 * message is never shown. Any other failure gets the words of its error code, and with `reasons`
 * (a place that has no field to put them under: a switch or a delete in the list) the words of the
 * reasons it names.
 */
export function templateFailureText(
  intl: Translator,
  error: unknown,
  options: { reasons?: boolean } = {},
): string {
  const rule = recallRuleOf(error);
  if (rule === null) {
    return options.reasons ? withReasons(intl, error) : describeFailure(intl, error).text;
  }
  return intl.formatMessage(
    { id: 'push.templates.defaultLanguageRequired' },
    {
      reason: codeText(intl, 'push.reason', rule.reason),
      defaultLocale: plainText(rule.defaultLocale),
    },
  );
}
