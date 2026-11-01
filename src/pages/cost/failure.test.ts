import { describe, expect, it } from 'vitest';
import enUS from '../../locales/en-US';
import { ApiError } from '../../request/errors';
import { failureLines } from './failure';

const intl = {
  messages: enUS as Record<string, unknown>,
  formatMessage: ({ id }: { id: string }) => (enUS as Record<string, string>)[id] ?? id,
};
const error = (
  code: string,
  details: { ref: string; reason: string }[] = [],
  message = 'raw backend words',
) => new ApiError({ code, httpStatus: 400, message, data: { details } });

describe('failureLines: the words of the codes, never the backend words', () => {
  it('has the text of the error code and one line for each reason that has a translation', () => {
    const lines = failureLines(
      intl,
      error('INVALID_REQUEST', [
        { ref: 'bands', reason: 'OUT_OF_RANGE' },
        { ref: 'currency', reason: 'OUT_OF_RANGE' },
        { ref: 'x', reason: 'EMPTY_NOT_ALLOWED' },
      ]),
    );
    expect(lines.text).toBe('Some input is not valid. Please check the fields and try again.');
    expect(lines.reasons).toEqual([
      'The value is outside the allowed range.',
      'It must not be empty.',
    ]);
  });

  it('leaves out a reason that has no translation, and never shows the backend message for a known code', () => {
    const lines = failureLines(
      intl,
      error('INVALID_REQUEST', [{ ref: 'bands', reason: 'SOMETHING_NEW' }]),
    );
    expect(lines.reasons).toEqual([]);
    expect(JSON.stringify(lines)).not.toContain('raw backend words');
  });

  it('says the words given for a ref instead of the words of its reason, and still the others', () => {
    const lines = failureLines(
      intl,
      error('INVALID_REQUEST', [
        { ref: 'currency', reason: 'OUT_OF_RANGE' },
        { ref: 'x', reason: 'EMPTY_NOT_ALLOWED' },
      ]),
      { currency: 'cost.pending.currencyRefused' },
    );
    expect(lines.reasons).toEqual([
      enUS['cost.pending.currencyRefused' as keyof typeof enUS],
      'It must not be empty.',
    ]);
    expect(JSON.stringify(lines)).not.toContain('raw backend words');
  });

  it('shows a failure that is not an ApiError as the unknown error, not as a network failure', () => {
    expect(failureLines(intl, new Error('boom')).text).toBe(enUS['error.UNKNOWN']);
  });
});
