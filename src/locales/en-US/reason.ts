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
};

export default messages;
