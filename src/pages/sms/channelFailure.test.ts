import { describe, expect, it } from 'vitest';
import enUS from '../../locales/en-US';
import zhCN from '../../locales/zh-CN';
import { ApiError } from '../../request/errors';
import { guardedFailureText, isLastChannelRefusal, lastChannelReason } from './useLastOtpPrompt';

const refusal = (details: unknown, code = 'INVALID_REQUEST') =>
  new ApiError({ code, httpStatus: 400, message: 'BACKEND SENTENCE', data: { details } });

const intlOf = (messages: Record<string, string>) => ({
  messages,
  formatMessage: ({ id }: { id: string }) => messages[id] ?? id,
});
const intl = intlOf(enUS as Record<string, string>);

const LAST = [{ ref: 'SmsChannel', reason: 'LAST_OTP_CHANNEL' }];
const COUNTRY = [{ ref: 'SmsChannel', reason: 'COUNTRY_LOSES_OTP_CHANNEL' }];

describe('the refusal that the last enabled OTP channel of a country must stay (updated interface document 23.4)', () => {
  it('is the detail with ref SmsChannel and reason LAST_OTP_CHANNEL or COUNTRY_LOSES_OTP_CHANNEL, also among others', () => {
    expect(lastChannelReason(refusal(LAST))).toBe('LAST_OTP_CHANNEL');
    expect(lastChannelReason(refusal(COUNTRY))).toBe('COUNTRY_LOSES_OTP_CHANNEL');
    expect(isLastChannelRefusal(refusal(LAST))).toBe(true);
    expect(
      lastChannelReason(refusal([{ ref: 'countries', reason: 'OUT_OF_RANGE' }, ...COUNTRY])),
    ).toBe('COUNTRY_LOSES_OTP_CHANNEL');
  });

  it.each([
    [
      'the old OUT_OF_RANGE, which no longer means this',
      [{ ref: 'SmsChannel', reason: 'OUT_OF_RANGE' }],
    ],
    ['another reason', [{ ref: 'SmsChannel', reason: 'EMPTY_NOT_ALLOWED' }]],
    [
      'the template ref with a channel reason',
      [{ ref: 'SmsTemplate', reason: 'LAST_OTP_CHANNEL' }],
    ],
    ['a field of the form', [{ ref: 'countries', reason: 'OUT_OF_RANGE' }]],
    ['no details', []],
    ['details that are not a list', 'SmsChannel'],
  ])('is not it for %s', (_name, details) => {
    expect(isLastChannelRefusal(refusal(details))).toBe(false);
  });

  it('is not it for another code or for something that is not from the backend', () => {
    expect(isLastChannelRefusal(refusal(LAST, 'INVALID_STATE'))).toBe(false);
    expect(isLastChannelRefusal(new Error('SmsChannel'))).toBe(false);
    expect(isLastChannelRefusal(undefined)).toBe(false);
  });

  it('says a fixed text of its own for each of the two cases, never the message of the backend', () => {
    const last = guardedFailureText(intl, refusal(LAST));
    const country = guardedFailureText(intl, refusal(COUNTRY));
    expect(last).toBe(enUS['reason.LAST_OTP_CHANNEL']);
    expect(country).toBe(enUS['reason.COUNTRY_LOSES_OTP_CHANNEL']);
    expect(last).not.toBe(country);
    expect(last).toMatch(/last enabled OTP channel/);
    expect(country).toMatch(/a country .* would have none/);
    expect(`${last}${country}`).not.toContain('BACKEND SENTENCE');
    const zh = intlOf(zhCN as Record<string, string>);
    expect(guardedFailureText(zh, refusal(LAST))).toBe(zhCN['reason.LAST_OTP_CHANNEL']);
    expect(guardedFailureText(zh, refusal(COUNTRY))).toBe(zhCN['reason.COUNTRY_LOSES_OTP_CHANNEL']);
  });

  it('does not translate OUT_OF_RANGE on SmsChannel as this refusal any more: it is the words of the code', () => {
    expect(guardedFailureText(intl, refusal([{ ref: 'SmsChannel', reason: 'OUT_OF_RANGE' }]))).toBe(
      enUS['error.INVALID_REQUEST'],
    );
  });

  it('says the words of the code for any other failure, with no line about phone sign-in', () => {
    expect(guardedFailureText(intl, refusal([{ ref: 'countries', reason: 'OUT_OF_RANGE' }]))).toBe(
      enUS['error.INVALID_REQUEST'],
    );
    expect(guardedFailureText(intl, refusal(undefined))).toBe(enUS['error.INVALID_REQUEST']);
  });
});
