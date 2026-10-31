import { describe, expect, it } from 'vitest';
import enUS from '../../locales/en-US';
import { ApiError } from '../../request/errors';
import { isEnglishFallbackRefusal, templateFailureText } from './templateFailure';

const refusal = (details: unknown, code = 'INVALID_REQUEST') =>
  new ApiError({ code, httpStatus: 400, message: 'BACKEND SENTENCE', data: { details } });

const intl = {
  messages: enUS as Record<string, string>,
  formatMessage: ({ id }: { id: string }) => (enUS as Record<string, string>)[id] ?? id,
};

describe('the refusal that the English OTP template for every country must stay', () => {
  it('is the detail with ref SmsTemplate and reason OUT_OF_RANGE, among others too', () => {
    expect(
      isEnglishFallbackRefusal(refusal([{ ref: 'SmsTemplate', reason: 'OUT_OF_RANGE' }])),
    ).toBe(true);
    expect(
      isEnglishFallbackRefusal(
        refusal([
          { ref: 'country', reason: 'OUT_OF_RANGE' },
          { ref: 'SmsTemplate', reason: 'OUT_OF_RANGE' },
        ]),
      ),
    ).toBe(true);
  });

  it.each([
    ['an out-of-range country', [{ ref: 'country', reason: 'OUT_OF_RANGE' }]],
    ['an out-of-range type', [{ ref: 'smsType', reason: 'OUT_OF_RANGE' }]],
    ['SmsTemplate with another reason', [{ ref: 'SmsTemplate', reason: 'EMPTY_NOT_ALLOWED' }]],
    ['a setting key as the ref', [{ ref: 'auth.phone_login_enabled', reason: 'OUT_OF_RANGE' }]],
    ['no details', []],
    ['details that are not a list', 'SmsTemplate'],
  ])('is not it for %s', (_name, details) => {
    expect(isEnglishFallbackRefusal(refusal(details))).toBe(false);
  });

  it('is not it for another code, or for something that is not from the backend', () => {
    expect(
      isEnglishFallbackRefusal(
        refusal([{ ref: 'SmsTemplate', reason: 'OUT_OF_RANGE' }], 'INVALID_STATE'),
      ),
    ).toBe(false);
    expect(isEnglishFallbackRefusal(new Error('SmsTemplate'))).toBe(false);
    expect(isEnglishFallbackRefusal(undefined)).toBe(false);
  });

  it('says the words of the rule only for it, and the words of the code (never the message) for the rest', () => {
    const rule = templateFailureText(
      intl,
      refusal([{ ref: 'SmsTemplate', reason: 'OUT_OF_RANGE' }]),
      true,
    );
    expect(rule).toBe(enUS['sms.templates.englishRefused']);
    const other = templateFailureText(
      intl,
      refusal([{ ref: 'country', reason: 'OUT_OF_RANGE' }]),
      false,
    );
    expect(other).toBe(enUS['error.INVALID_REQUEST']);
    expect(other).not.toBe(rule);
    const guarded = templateFailureText(
      intl,
      refusal([{ ref: 'SmsTemplate', reason: 'EMPTY_NOT_ALLOWED' }]),
      true,
    );
    expect(guarded).toContain(enUS['sms.guard.refused']);
    expect(guarded).not.toContain('BACKEND SENTENCE');
  });
});
