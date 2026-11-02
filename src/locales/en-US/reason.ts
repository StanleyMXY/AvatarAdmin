const messages: Record<string, string> = {
  'reason.ACCOUNT_NOT_FOUND': 'The account does not exist.',
  'reason.ACCOUNT_NOT_ACTIVE': 'The account is not active.',
  'reason.NOT_HTTPS': 'The link must start with lowercase https://.',
  'reason.INVALID_HOST':
    'The host is not valid (write internationalized domains as xn--…, and no user info).',
  'reason.INVALID_PORT': 'The port must be 1 to 5 digits.',
  'reason.INVALID_PATH':
    'The path has characters that are not allowed (percent-encode non-ASCII characters; no spaces or backslashes).',
  'reason.TOO_LONG': 'The value is too long.',
  'reason.INVALID_EMAIL': 'The email address is not valid.',
  'reason.NOT_AN_INTEGER': 'It must be a whole number.',
  'reason.OUT_OF_RANGE': 'The value is outside the allowed range.',
  'reason.NOT_BOOLEAN': 'It must be true or false.',
  'reason.INVALID_LANGUAGE_TAG': 'The language tag is not valid.',
  'reason.EMPTY_NOT_ALLOWED': 'It must not be empty.',
  'reason.INVALID_PATTERN': 'The regular expression cannot be compiled.',
  'reason.RESOURCE_NOT_FOUND': 'The referenced item does not exist.',
  'reason.DUPLICATE': 'This item is repeated; each one may appear only once.',
  'reason.INVALID_CHARACTER':
    'The text contains a character that is not allowed (the null character, U+0000).',
  'reason.INVALID_FORMAT':
    'The format is not valid, or it contains characters that cannot be stored as they are.',
  'reason.PACKAGE_NAME_NOT_CONFIGURED':
    'The Google Play package name is not configured on the backend, so a Play Store link cannot be saved.',
  'reason.SOURCE_EXPIRED':
    'The source data for the backfill has expired, so it cannot be backfilled.',
  'reason.TOO_SLOW': 'This query took too long. Narrow the time range and try again.',
  'reason.TOO_MANY_EVENTS':
    'There are too many events to read in this time range. Narrow it and try again.',
  'reason.REQUIRED': 'It is required.',
  'reason.INVALID_TYPE': 'The value is of the wrong type.',
  'reason.CONTROL_CHARACTER': 'It contains a control character that is not allowed.',
  'reason.IMMUTABLE': 'It cannot be changed after creation.',
  'reason.NOT_FOUND': 'The item you named does not exist.',
  'reason.DISABLED': 'It is disabled and cannot be chosen.',
  'reason.CURRENCY_MISMATCH': 'The currency differs from the currency used for campaign costs.',
};

export default messages;
