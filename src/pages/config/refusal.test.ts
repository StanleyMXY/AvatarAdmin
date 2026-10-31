import { createIntl } from 'react-intl';
import { describe, expect, it } from 'vitest';
import enUS from '../../locales/en-US';
import zhCN from '../../locales/zh-CN';
import { ApiError } from '../../request/errors';
import { refusalAlertText, refusalTexts } from './refusal';

const intlOf = (locale: 'en-US' | 'zh-CN') =>
  createIntl({
    locale,
    messages: locale === 'en-US' ? enUS : zhCN,
    onError: () => {},
  }) as unknown as Parameters<typeof refusalTexts>[0];

const refusal = (
  details: { ref: string; reason: string }[],
  message = 'BACKEND-MSG-A',
  code = 'INVALID_REQUEST',
) => new ApiError({ code, httpStatus: 400, message, data: { details } });

const CATCHUP = 'push.schedule_catchup_minutes';
const POLL = 'push.task_poll_seconds';
const DEADLINE = 'chat.moderation_deadline_ms';
const ALLOWED = 'usage_price.allowed_currencies';

describe('refusalTexts: a reason the page has no words for never shows the backend message', () => {
  it.each(['en-US', 'zh-CN'] as const)('uses the general words of the key in %s', (locale) => {
    const intl = intlOf(locale);
    const { rows } = refusalTexts(
      intl,
      refusal([{ ref: DEADLINE, reason: 'WEIRD_REASON' }]),
      new Set([DEADLINE]),
      DEADLINE,
    );
    const text = rows.get(DEADLINE) as string;
    expect(text).toBe(intl.formatMessage({ id: 'config.refusal.unknownReason' }));
    expect(text).not.toContain('BACKEND-MSG-A');
    expect(text).not.toContain('WEIRD_REASON');
    if (locale === 'zh-CN') expect(text).toMatch(/[㐀-鿿]/);
  });

  it('uses the general words of the reason when the language file has them', () => {
    const intl = intlOf('en-US');
    const { rows } = refusalTexts(
      intl,
      refusal([{ ref: DEADLINE, reason: 'NOT_BOOLEAN' }]),
      new Set([DEADLINE]),
      DEADLINE,
    );
    expect(rows.get(DEADLINE)).toBe('It must be true or false.');
  });

  it('uses the general words for a detail that names no setting key, at the top', () => {
    const intl = intlOf('en-US');
    const { rows, top } = refusalTexts(
      intl,
      refusal([{ ref: 'SmsTemplate', reason: 'WEIRD_REASON' }]),
      new Set([DEADLINE]),
      DEADLINE,
    );
    expect(rows.size).toBe(0);
    expect(top).toEqual([intl.formatMessage({ id: 'config.refusal.unknownReason' })]);
  });
});

describe('refusalAlertText: the words of the saved row for the refusal as a whole', () => {
  it('does not append the backend message to an error code the page has no words for', () => {
    const intl = intlOf('en-US');
    const text = refusalAlertText(intl, refusal([], 'BACKEND-MSG-C', 'SOMETHING_NEW'));
    expect(text).toBe(intl.formatMessage({ id: 'error.UNKNOWN' }));
    expect(text).not.toContain('BACKEND-MSG-C');
  });

  it('gives the words of a known error code, in the language of the page', () => {
    const intl = intlOf('zh-CN');
    expect(refusalAlertText(intl, refusal([], 'BACKEND-MSG-D'))).toBe(
      intl.formatMessage({ id: 'error.INVALID_REQUEST' }),
    );
  });
});

describe('refusalTexts: where the words of each detail go', () => {
  const intl = intlOf('en-US');

  it('puts the words of a key the form does not show at the top when the saved row has none of its own', () => {
    const { rows, top } = refusalTexts(
      intl,
      refusal([{ ref: ALLOWED, reason: 'OUT_OF_RANGE' }]),
      new Set([CATCHUP]),
      CATCHUP,
    );
    expect(rows.size).toBe(0);
    expect(top).toEqual([intl.formatMessage({ id: `config.${ALLOWED}.reject.OUT_OF_RANGE` })]);
  });

  it('leaves the words of a key the form does not show out when the saved row has its own', () => {
    const { rows, top } = refusalTexts(
      intl,
      refusal([
        { ref: CATCHUP, reason: 'OUT_OF_RANGE' },
        { ref: ALLOWED, reason: 'OUT_OF_RANGE' },
      ]),
      new Set([CATCHUP]),
      CATCHUP,
    );
    expect(rows.has(CATCHUP)).toBe(true);
    expect(top).toEqual([]);
  });

  it('puts the words of a detail that is not a setting key at the top even when the saved row has its own', () => {
    const { rows, top } = refusalTexts(
      intl,
      refusal([
        { ref: DEADLINE, reason: 'OUT_OF_RANGE' },
        { ref: 'SmsTemplate', reason: 'EMPTY_NOT_ALLOWED' },
      ]),
      new Set([DEADLINE]),
      DEADLINE,
    );
    expect(rows.has(DEADLINE)).toBe(true);
    expect(top).toEqual([
      intl.formatMessage({ id: 'config.refusal.SmsTemplate.EMPTY_NOT_ALLOWED' }),
    ]);
  });

  it('takes the first detail when one key is named twice', () => {
    const { rows } = refusalTexts(
      intl,
      refusal([
        { ref: DEADLINE, reason: 'NOT_BOOLEAN' },
        { ref: DEADLINE, reason: 'NOT_AN_INTEGER' },
      ]),
      new Set([DEADLINE]),
      DEADLINE,
    );
    expect(rows.get(DEADLINE)).toBe('It must be true or false.');
  });
});

describe('refusalTexts: the two push keys that depend on each other', () => {
  const intl = intlOf('en-US');
  const both = refusal([
    { ref: CATCHUP, reason: 'OUT_OF_RANGE' },
    { ref: POLL, reason: 'OUT_OF_RANGE' },
  ]);

  it('says nothing on the poll seconds when the catch-up minutes were saved: the rule hint stays', () => {
    const { rows, top } = refusalTexts(intl, both, new Set([CATCHUP, POLL]), CATCHUP);
    expect(rows.get(CATCHUP)).toMatch(/1 to 10080/);
    expect(rows.has(POLL)).toBe(false);
    expect(top).toEqual([]);
  });

  it('says nothing on the catch-up minutes when the poll seconds were saved', () => {
    const { rows } = refusalTexts(intl, both, new Set([CATCHUP, POLL]), POLL);
    expect(rows.get(POLL)).toMatch(/at least 1/);
    expect(rows.has(CATCHUP)).toBe(false);
  });

  it('does not move the words of the row that was not saved to the top when it is not shown', () => {
    const { rows, top } = refusalTexts(intl, both, new Set([POLL]), POLL);
    expect(rows.has(POLL)).toBe(true);
    expect(top).toEqual([]);
    const other = refusalTexts(
      intl,
      refusal([{ ref: CATCHUP, reason: 'OUT_OF_RANGE' }]),
      new Set([POLL]),
      POLL,
    );
    expect(other.top).toEqual([]);
  });
});
