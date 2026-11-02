import { describe, expect, it } from 'vitest';
import enUS from '../../locales/en-US';
import { ApiError } from '../../request/errors';
import { isLastTemplateRefusal, templateFailureText } from './templateFailure';

const refusal = (details: unknown, code = 'INVALID_REQUEST') =>
  new ApiError({ code, httpStatus: 400, message: 'BACKEND SENTENCE', data: { details } });

const intl = {
  messages: enUS as Record<string, string>,
  formatMessage: ({ id }: { id: string }) => (enUS as Record<string, string>)[id] ?? id,
};

describe('the refusal that an OTP template must stay (the last enabled one, or the last English one for every country: the same ref and reason, answers 41)', () => {
  it('is the detail with ref SmsTemplate and reason OUT_OF_RANGE, among others too', () => {
    expect(isLastTemplateRefusal(refusal([{ ref: 'SmsTemplate', reason: 'OUT_OF_RANGE' }]))).toBe(
      true,
    );
    expect(
      isLastTemplateRefusal(
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
    expect(isLastTemplateRefusal(refusal(details))).toBe(false);
  });

  it('is not it for another code, or for something that is not from the backend', () => {
    expect(
      isLastTemplateRefusal(
        refusal([{ ref: 'SmsTemplate', reason: 'OUT_OF_RANGE' }], 'INVALID_STATE'),
      ),
    ).toBe(false);
    expect(isLastTemplateRefusal(new Error('SmsTemplate'))).toBe(false);
    expect(isLastTemplateRefusal(undefined)).toBe(false);
  });

  it('says the words of the rule only for it, and the words of the code (never the message, no extra line) for the rest', () => {
    const rule = templateFailureText(
      intl,
      refusal([{ ref: 'SmsTemplate', reason: 'OUT_OF_RANGE' }]),
    );
    expect(rule).toBe(enUS['sms.templates.lastRefused']);
    // One text for both cases: the last enabled OTP template, and the last English one for every country.
    expect(rule).toMatch(/at least one enabled OTP template must remain/);
    expect(rule).toMatch(/English \(en\) for every country/);
    const other = templateFailureText(intl, refusal([{ ref: 'country', reason: 'OUT_OF_RANGE' }]));
    expect(other).toBe(enUS['error.INVALID_REQUEST']);
    expect(other).not.toBe(rule);
    const sameRefOtherReason = templateFailureText(
      intl,
      refusal([{ ref: 'SmsTemplate', reason: 'EMPTY_NOT_ALLOWED' }]),
    );
    expect(sameRefOtherReason).not.toContain('BACKEND SENTENCE');
    expect(sameRefOtherReason).not.toBe(rule);
  });

  it('adds no line about phone sign-in to a 400 without details: the backend gives details for this rule, so such a 400 is something else', () => {
    const text = templateFailureText(intl, refusal(undefined));
    expect(text).toBe(enUS['error.INVALID_REQUEST']);
  });
});
