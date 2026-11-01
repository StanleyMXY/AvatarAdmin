import { describe, expect, it } from 'vitest';
import enUS from '../locales/en-US';
import { ApiError } from '../request/errors';
import { failureLine } from './failureLine';

const intl = {
  messages: enUS as Record<string, unknown>,
  formatMessage: ({ id }: { id: string }) => (enUS as Record<string, string>)[id] ?? id,
};

const refusal = (code: string, httpStatus: number, data: unknown) =>
  new ApiError({ code, httpStatus, message: 'backend words', data });

describe('failureLine', () => {
  it('gives the text of the error only, when there are no details', () => {
    expect(failureLine(intl, refusal('INVALID_STATE', 409, { status: 'X' }))).toBe(
      enUS['error.INVALID_STATE'],
    );
  });

  it('adds each detail as name and reason, in the words of the language, never the words of the backend', () => {
    const line = failureLine(
      intl,
      refusal('INVALID_REQUEST', 400, {
        details: [
          { ref: 'creditCost', reason: 'OUT_OF_RANGE' },
          { ref: 'note', reason: 'TOO_LONG' },
        ],
      }),
    );
    expect(line).toContain(enUS['error.INVALID_REQUEST']);
    expect(line).toContain(`creditCost: ${enUS['reason.OUT_OF_RANGE']}`);
    expect(line).toContain('note: ');
    expect(line.split(' / ')).toHaveLength(3);
  });

  it('treats a failure that is not an ApiError as the unknown error (not a network failure), without throwing', () => {
    expect(failureLine(intl, new TypeError('boom'))).toBe(enUS['error.UNKNOWN']);
  });
});
