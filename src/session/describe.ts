import { ApiError, describeError, networkError } from '../request/errors';

/**
 * The texts for a failed request, in the current language: the text of the error and one per
 * field detail. Anything that is not an `ApiError` is shown as a network failure.
 */
/** The part of `useIntl()` this needs (Umi's copy of react-intl and ours have different types). */
type Translator = {
  messages: Record<string, unknown>;
  formatMessage: (descriptor: { id: string }) => string;
};

export function describeFailure(intl: Translator, failure: unknown) {
  const error = failure instanceof ApiError ? failure : networkError();
  const described = describeError(error, (key) =>
    intl.messages[key] ? intl.formatMessage({ id: key }) : key,
  );
  return { error, ...described };
}
