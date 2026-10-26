import { type LinkReasonKey, validateServerLink } from '../../utils/linkRule';
import { trimSpec } from '../../utils/trimSpec';

/** The reason codes of the language file (`reason.<code>`) that a value can fail with. */
export type ValueProblem =
  | LinkReasonKey
  | 'EMPTY_NOT_ALLOWED'
  | 'INVALID_EMAIL'
  | 'NOT_BOOLEAN'
  | 'NOT_AN_INTEGER'
  | 'READ_ONLY';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX = 254;

/**
 * The value as it is saved: a link or an address loses the whitespace at both ends (the contract's
 * definition of whitespace), so the text that was checked is the text that is sent. A text keeps
 * what was typed. Anything else is left alone.
 */
export function cleanValue(type: string, value: unknown): unknown {
  return (type === 'URL' || type === 'EMAIL') && typeof value === 'string'
    ? trimSpec(value)
    : value;
}

/**
 * Why a value cannot be saved for a key of this type, or null. The checks are those of the type
 * (contract 26.1): an https link by the link rule (1.7), an e-mail address, a boolean, a whole
 * number. An empty link or address is refused (a key with nothing is `reset`, not saved empty); an
 * empty text is a value. A list, or a type this page does not know, is not edited here.
 */
export function validateValue(type: string, value: unknown): ValueProblem | null {
  switch (type) {
    case 'URL': {
      const text = typeof value === 'string' ? trimSpec(value) : '';
      if (text === '') return 'EMPTY_NOT_ALLOWED';
      const check = validateServerLink(text);
      return check.ok ? null : check.reasonKey;
    }
    case 'EMAIL': {
      const text = typeof value === 'string' ? trimSpec(value) : '';
      if (text === '') return 'EMPTY_NOT_ALLOWED';
      return text.length <= EMAIL_MAX && EMAIL.test(text) ? null : 'INVALID_EMAIL';
    }
    case 'STRING':
      return typeof value === 'string' ? null : 'EMPTY_NOT_ALLOWED';
    case 'BOOLEAN':
      return typeof value === 'boolean' ? null : 'NOT_BOOLEAN';
    case 'INT':
      if (value === null || value === undefined) return 'EMPTY_NOT_ALLOWED';
      return typeof value === 'number' && Number.isSafeInteger(value) ? null : 'NOT_AN_INTEGER';
    default:
      return 'READ_ONLY';
  }
}
