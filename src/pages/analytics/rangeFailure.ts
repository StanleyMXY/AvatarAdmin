import { describeFailure } from '../../session/describe';

/**
 * The words of a failed read of a live endpoint: the general words of the error code, then the
 * reason the backend gave for the range (`from` or `to`: the range is longer than allowed, the
 * read took too long, there were too many events), so that the person knows to choose a shorter
 * range. The words of a reason come from `analytics.range.reason.<reason>` (the reasons of these
 * endpoints), else from `reason.<reason>` (the shared ones); a reason with neither is left out,
 * and the backend's own message is never shown.
 */
export function rangeFailureText(
  intl: Parameters<typeof describeFailure>[0],
  failure: unknown,
): string {
  const { text, error } = describeFailure(intl, failure);
  const lines: string[] = [];
  for (const detail of error.details) {
    if (detail.ref !== 'from' && detail.ref !== 'to') continue;
    const key = [`analytics.range.reason.${detail.reason}`, `reason.${detail.reason}`].find(
      (id) => intl.messages[id],
    );
    if (key) lines.push(intl.formatMessage({ id: key }));
  }
  return lines.length === 0 ? text : `${text} ${lines.join(' ')}`;
}
