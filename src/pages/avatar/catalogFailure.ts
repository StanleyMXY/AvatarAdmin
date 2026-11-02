import { ApiError } from '../../request/errors';
import { describeFailure, type Translator } from '../../session/describe';

/**
 * The words for a refused save or switch of a cosmetic: a 409 `INVALID_STATE` that names the kind
 * (`data.kind`) says that the type has to keep its one default item, on sale, free and fitting both
 * styles; any other failure is told by its error code, never by the backend's message.
 */
export function catalogFailureText(intl: Translator, error: unknown): string {
  if (error instanceof ApiError && error.code === 'INVALID_STATE') {
    const kind = (error.data as { kind?: unknown } | null)?.kind;
    if (typeof kind === 'string' && kind !== '') {
      return intl.formatMessage({ id: 'avatar.cosmetics.defaultKept' });
    }
  }
  return describeFailure(intl, error).text;
}
