import { describeFailure } from '../../session/describe';

type Translator = Parameters<typeof describeFailure>[0];

/**
 * What to show for a failed write: the text of the error code and, for a refused input, the text of
 * each reason that this app has a translation for. The backend's own words are never shown for a code
 * that is known; a reason that is not translated is left out.
 */
export function failureLines(
  intl: Translator,
  failure: unknown,
): { text: string; reasons: string[] } {
  const { error, text } = describeFailure(intl, failure);
  const reasons = [
    ...new Set(
      error.details
        .map((detail) => `reason.${detail.reason}`)
        .filter((id) => Boolean(intl.messages[id]))
        .map((id) => intl.formatMessage({ id })),
    ),
  ];
  return { text, reasons };
}
