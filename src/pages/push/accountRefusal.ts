import { ApiError } from '../../request/errors';
import type { FieldReason } from '../../utils/fieldReasons';

/** The most account ids written out in the words; the rest is counted. */
const SHOWN = 10;

/** The ids the backend says do not exist: each `ACCOUNT_NOT_FOUND` detail names one by its `ref`. */
export function missingAccountIds(error: unknown): string[] {
  if (!(error instanceof ApiError)) return [];
  return error.details.filter((d) => d.reason === 'ACCOUNT_NOT_FOUND').map((d) => d.ref);
}

/**
 * The reason under the account id box when the backend refused a task or a periodic push because
 * some of the accounts are not there, or null when it did not. It names the ids, written again in
 * the language of the moment.
 */
export function accountsNotFoundReason(error: unknown): FieldReason | null {
  const ids = missingAccountIds(error);
  if (ids.length === 0) return null;
  const list = ids.slice(0, SHOWN).join(', ');
  const more = ids.length - SHOWN;
  return {
    name: 'accountIdsText',
    write: (words) =>
      words.formatMessage(
        { id: more > 0 ? 'push.audience.accountsNotFoundMore' : 'push.audience.accountsNotFound' },
        { list, more },
      ),
  };
}
