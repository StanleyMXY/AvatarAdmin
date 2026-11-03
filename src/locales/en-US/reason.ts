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
  'reason.MISSING': 'This value was not sent; it must be given.',
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
  'reason.LAST_OTP_CHANNEL':
    'This is the last enabled OTP channel. While phone sign-in is on or phone-number accounts exist, at least one enabled OTP channel must remain, so it cannot be deleted, switched off or changed to another type. Enable or create another OTP channel first.',
  'reason.COUNTRY_LOSES_OTP_CHANNEL':
    'After this change a country that is served by an enabled OTP channel now would have none. While phone sign-in is on or phone-number accounts exist, every country that may receive codes must stay served by an enabled OTP channel. Create another OTP channel, or widen the countries of another one, first.',
  'reason.LAST_OTP_TEMPLATE':
    'This is the last enabled OTP template. While phone sign-in is on or phone-number accounts exist, at least one enabled OTP template must remain, so it cannot be deleted, switched off or changed to another type. Enable or create another one first.',
  'reason.LAST_ENGLISH_FALLBACK_TEMPLATE':
    'This is the last enabled OTP template in English (en) for every country (no country set). While phone sign-in is on or phone-number accounts exist, one must remain, so it cannot be deleted, switched off, or changed in language, country or type. Enable or create another one first.',
  'reason.NEGATIVE': 'The amount is below 0.',
  'reason.TOO_MANY_DECIMALS': 'The amount has more than two decimals.',
};

export default messages;
