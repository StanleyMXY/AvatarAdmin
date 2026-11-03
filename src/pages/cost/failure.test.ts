import { describe, expect, it } from 'vitest';
import enUS from '../../locales/en-US';
import { ApiError } from '../../request/errors';
import { bandPlace, failureLines, refusalLine } from './failure';

const intl = {
  messages: enUS as Record<string, unknown>,
  formatMessage: ({ id }: { id: string }, values: Record<string, string | number> = {}) =>
    ((enUS as Record<string, string>)[id] ?? id).replace(/\{(\w+)\}/g, (_, name: string) =>
      String(values[name]),
    ),
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

describe('the path of a field of a band', () => {
  it('names the band (from 0) and the field, for the five fields of a band only', () => {
    expect(bandPlace('bands[1].inputMinTokens')).toEqual({ index: 1, field: 'inputMinTokens' });
    expect(bandPlace('bands[12].cachedInputPrice')).toEqual({
      index: 12,
      field: 'cachedInputPrice',
    });
    for (const ref of ['bands', 'bands[1]', 'bands[1].other', 'bands[x].inputPrice', 'unitPrice']) {
      expect(bandPlace(ref), ref).toBeNull();
    }
  });

  it('says which band and which field in front of the words of the reason, counting from 1', () => {
    expect(refusalLine(intl, { ref: 'bands[1].inputMinTokens', reason: 'NOT_AN_INTEGER' })).toBe(
      'Band 2: lower bound (tokens): It must be a whole number.',
    );
    expect(refusalLine(intl, { ref: 'bands[0].outputPrice', reason: 'OUT_OF_RANGE' })).toBe(
      'Band 1: output price: The value is outside the allowed range.',
    );
  });

  it('is the words of the reason for any other ref, the words given for the ref, and nothing for a reason without words', () => {
    expect(refusalLine(intl, { ref: 'unitPrice', reason: 'EMPTY_NOT_ALLOWED' })).toBe(
      'It must not be empty.',
    );
    expect(
      refusalLine(
        intl,
        { ref: 'currency', reason: 'OUT_OF_RANGE' },
        { currency: 'cost.pending.currencyRefusedNoList' },
      ),
    ).toBe(enUS['cost.pending.currencyRefusedNoList' as keyof typeof enUS]);
    expect(refusalLine(intl, { ref: 'bands[1].inputPrice', reason: 'SOMETHING_NEW' })).toBeNull();
  });

  it('puts the band line in the lines of a failed write', () => {
    const lines = failureLines(
      intl,
      error('INVALID_REQUEST', [{ ref: 'bands[2].inputMaxTokens', reason: 'EMPTY_NOT_ALLOWED' }]),
    );
    expect(lines.reasons).toEqual(['Band 3: upper bound (tokens): It must not be empty.']);
  });
});
