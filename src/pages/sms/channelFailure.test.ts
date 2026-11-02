import { describe, expect, it } from 'vitest';
import enUS from '../../locales/en-US';
import zhCN from '../../locales/zh-CN';
import { ApiError } from '../../request/errors';
import { guardedFailureText, isLastChannelRefusal } from './useLastOtpPrompt';

const refusal = (details: unknown, code = 'INVALID_REQUEST') =>
  new ApiError({ code, httpStatus: 400, message: 'BACKEND SENTENCE', data: { details } });

const intlOf = (messages: Record<string, string>) => ({
  messages,
  formatMessage: ({ id }: { id: string }) => messages[id] ?? id,
});
const intl = intlOf(enUS as Record<string, string>);

describe('the refusal that the last enabled OTP channel of a country must stay (answers 41)', () => {
  it('is the detail with ref SmsChannel and reason OUT_OF_RANGE, also among others', () => {
    expect(isLastChannelRefusal(refusal([{ ref: 'SmsChannel', reason: 'OUT_OF_RANGE' }]))).toBe(
      true,
    );
    expect(
      isLastChannelRefusal(
        refusal([
          { ref: 'countries', reason: 'OUT_OF_RANGE' },
          { ref: 'SmsChannel', reason: 'OUT_OF_RANGE' },
        ]),
      ),
    ).toBe(true);
  });

  it.each([
    ['another reason', [{ ref: 'SmsChannel', reason: 'EMPTY_NOT_ALLOWED' }]],
    ['the template ref', [{ ref: 'SmsTemplate', reason: 'OUT_OF_RANGE' }]],
    ['a field of the form', [{ ref: 'countries', reason: 'OUT_OF_RANGE' }]],
    ['no details', []],
    ['details that are not a list', 'SmsChannel'],
  ])('is not it for %s', (_name, details) => {
    expect(isLastChannelRefusal(refusal(details))).toBe(false);
  });

  it('is not it for another code or for something that is not from the backend', () => {
    expect(
      isLastChannelRefusal(
        refusal([{ ref: 'SmsChannel', reason: 'OUT_OF_RANGE' }], 'INVALID_STATE'),
      ),
    ).toBe(false);
    expect(isLastChannelRefusal(new Error('SmsChannel'))).toBe(false);
    expect(isLastChannelRefusal(undefined)).toBe(false);
  });

  it('says one fixed text that covers both cases (no channel left; a country left without one), never the message of the backend', () => {
    const text = guardedFailureText(intl, refusal([{ ref: 'SmsChannel', reason: 'OUT_OF_RANGE' }]));
    expect(text).toBe(enUS['sms.channels.lastRefused']);
    expect(text).toMatch(/at least one enabled OTP channel must remain/);
    expect(text).toMatch(/every country/);
    expect(text).not.toContain('BACKEND SENTENCE');
    expect(
      guardedFailureText(
        intlOf(zhCN as Record<string, string>),
        refusal([{ ref: 'SmsChannel', reason: 'OUT_OF_RANGE' }]),
      ),
    ).toBe(zhCN['sms.channels.lastRefused']);
  });

  it('says the words of the code for any other failure, with no line about phone sign-in', () => {
    expect(guardedFailureText(intl, refusal([{ ref: 'countries', reason: 'OUT_OF_RANGE' }]))).toBe(
      enUS['error.INVALID_REQUEST'],
    );
    expect(guardedFailureText(intl, refusal(undefined))).toBe(enUS['error.INVALID_REQUEST']);
  });
});
