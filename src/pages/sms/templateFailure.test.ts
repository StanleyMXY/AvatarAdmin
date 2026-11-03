import { describe, expect, it } from 'vitest';
import enUS from '../../locales/en-US';
import zhCN from '../../locales/zh-CN';
import { ApiError } from '../../request/errors';
import { isLastTemplateRefusal, lastTemplateReason, templateFailureText } from './templateFailure';

const refusal = (details: unknown, code = 'INVALID_REQUEST') =>
  new ApiError({ code, httpStatus: 400, message: 'BACKEND SENTENCE', data: { details } });

const intlOf = (messages: Record<string, string>) => ({
  messages,
  formatMessage: ({ id }: { id: string }) => messages[id] ?? id,
});
const intl = intlOf(enUS as Record<string, string>);

const LAST = [{ ref: 'SmsTemplate', reason: 'LAST_OTP_TEMPLATE' }];
const ENGLISH = [{ ref: 'SmsTemplate', reason: 'LAST_ENGLISH_FALLBACK_TEMPLATE' }];

describe('the refusal that an OTP template must stay (the last enabled one, or the last English one for every country: each has its own reason, updated interface document 23.4)', () => {
  it('is the detail with ref SmsTemplate and reason LAST_OTP_TEMPLATE or LAST_ENGLISH_FALLBACK_TEMPLATE, among others too', () => {
    expect(lastTemplateReason(refusal(LAST))).toBe('LAST_OTP_TEMPLATE');
    expect(lastTemplateReason(refusal(ENGLISH))).toBe('LAST_ENGLISH_FALLBACK_TEMPLATE');
    expect(
      isLastTemplateRefusal(refusal([{ ref: 'country', reason: 'OUT_OF_RANGE' }, ...ENGLISH])),
    ).toBe(true);
  });

  it.each([
    [
      'the old OUT_OF_RANGE, which no longer means this',
      [{ ref: 'SmsTemplate', reason: 'OUT_OF_RANGE' }],
    ],
    ['an out-of-range country', [{ ref: 'country', reason: 'OUT_OF_RANGE' }]],
    ['an out-of-range type', [{ ref: 'smsType', reason: 'OUT_OF_RANGE' }]],
    ['SmsTemplate with another reason', [{ ref: 'SmsTemplate', reason: 'EMPTY_NOT_ALLOWED' }]],
    [
      'the channel ref with a template reason',
      [{ ref: 'SmsChannel', reason: 'LAST_OTP_TEMPLATE' }],
    ],
    [
      'a setting key as the ref',
      [{ ref: 'auth.phone_login_enabled', reason: 'LAST_OTP_TEMPLATE' }],
    ],
    ['no details', []],
    ['details that are not a list', 'SmsTemplate'],
  ])('is not it for %s', (_name, details) => {
    expect(isLastTemplateRefusal(refusal(details))).toBe(false);
  });

  it('is not it for another code, or for something that is not from the backend', () => {
    expect(isLastTemplateRefusal(refusal(LAST, 'INVALID_STATE'))).toBe(false);
    expect(isLastTemplateRefusal(new Error('SmsTemplate'))).toBe(false);
    expect(isLastTemplateRefusal(undefined)).toBe(false);
  });

  it('says a fixed text of its own for each of the two cases, and the words of the code (never the message, no extra line) for the rest', () => {
    const last = templateFailureText(intl, refusal(LAST));
    const english = templateFailureText(intl, refusal(ENGLISH));
    expect(last).toBe(enUS['reason.LAST_OTP_TEMPLATE']);
    expect(english).toBe(enUS['reason.LAST_ENGLISH_FALLBACK_TEMPLATE']);
    expect(last).not.toBe(english);
    expect(last).toMatch(/at least one enabled OTP template must remain/);
    expect(english).toMatch(/English \(en\) for every country/);
    expect(`${last}${english}`).not.toContain('BACKEND SENTENCE');
    const zh = intlOf(zhCN as Record<string, string>);
    expect(templateFailureText(zh, refusal(LAST))).toBe(zhCN['reason.LAST_OTP_TEMPLATE']);
    expect(templateFailureText(zh, refusal(ENGLISH))).toBe(
      zhCN['reason.LAST_ENGLISH_FALLBACK_TEMPLATE'],
    );
    const other = templateFailureText(intl, refusal([{ ref: 'country', reason: 'OUT_OF_RANGE' }]));
    expect(other).toBe(enUS['error.INVALID_REQUEST']);
    const sameRefOtherReason = templateFailureText(
      intl,
      refusal([{ ref: 'SmsTemplate', reason: 'OUT_OF_RANGE' }]),
    );
    expect(sameRefOtherReason).toBe(enUS['error.INVALID_REQUEST']);
    expect(sameRefOtherReason).not.toContain('BACKEND SENTENCE');
  });

  it('adds no line about phone sign-in to a 400 without details: the backend gives details for this rule, so such a 400 is something else', () => {
    const text = templateFailureText(intl, refusal(undefined));
    expect(text).toBe(enUS['error.INVALID_REQUEST']);
  });
});
