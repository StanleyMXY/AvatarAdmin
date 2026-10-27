import { ApiError } from '../../request/errors';
import { describeFailure } from '../../session/describe';
import { codeText, type Translator } from './texts';

/**
 * The text for a refused action on a default avatar: a 409 INVALID_STATE says which state the
 * avatar is in now (`data.status`), 503 GENERATION_NOT_CONFIGURED says that what the generation
 * needs is not configured yet, and anything else is the usual text of the error.
 */
export function defaultAvatarFailure(intl: Translator, error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'INVALID_STATE') {
      const status = (error.data as { status?: unknown } | null)?.status;
      if (typeof status === 'string' && status !== '') {
        return intl.formatMessage(
          { id: 'avatar.defaults.invalidState' },
          { status: codeText(intl, 'avatar.defaults.status', status) },
        );
      }
    }
    if (error.code === 'GENERATION_NOT_CONFIGURED') {
      return intl.formatMessage({ id: 'avatar.defaults.notConfigured' });
    }
  }
  return describeFailure(intl, error).text;
}
