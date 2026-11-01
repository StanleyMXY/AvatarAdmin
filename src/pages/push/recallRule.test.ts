import { describe, expect, it } from 'vitest';
import enUS from '../../locales/en-US';
import zhCN from '../../locales/zh-CN';
import { ApiError } from '../../request/errors';
import { recallRuleOf, templateFailureText } from './recallRule';

const refusal = (data: unknown, code = 'INVALID_REQUEST', message = 'BACKEND SENTENCE') =>
  new ApiError({ code, httpStatus: 400, message, data });

const intlOf = (messages: Record<string, string>) => ({
  messages,
  formatMessage: ({ id }: { id: string }, values: Record<string, string | number> = {}) =>
    (messages[id] ?? id).replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? '')),
});

describe('recallRuleOf: the refusal of the rule of the default language (a5)', () => {
  it('reads the default language and the reason from data', () => {
    expect(recallRuleOf(refusal({ defaultLocale: 'th', reason: 'daily_recall' }))).toEqual({
      defaultLocale: 'th',
      reason: 'daily_recall',
    });
  });

  it.each([
    ['another code', refusal({ defaultLocale: 'en', reason: 'daily_recall' }, 'INVALID_STATE')],
    ['no data', refusal(null)],
    ['no default language', refusal({ reason: 'daily_recall' })],
    ['an empty default language', refusal({ defaultLocale: '', reason: 'daily_recall' })],
    ['no reason', refusal({ defaultLocale: 'en' })],
    ['a reason that is not text', refusal({ defaultLocale: 'en', reason: 3 })],
    [
      'the answer of saving push.default_locale (several reasons, no single one)',
      refusal({
        defaultLocale: 'th',
        reasons: ['daily_recall'],
        details: [{ ref: 'push.default_locale', reason: 'OUT_OF_RANGE' }],
      }),
    ],
    ['an error that is not from the backend', new Error('x')],
    ['nothing', undefined],
  ])('is null for %s', (_name, error) => {
    expect(recallRuleOf(error)).toBeNull();
  });
});

describe('templateFailureText', () => {
  const data = { defaultLocale: 'ไทย', reason: 'streak_at_risk' };

  it('says what to do in English with the default language and the reason named, and never the message of the backend', () => {
    const text = templateFailureText(intlOf(enUS), refusal(data));
    expect(text).toBe(
      'Streak at risk needs an enabled template in the default language (ไทย). Enable that one first. To switch it off, delete it or change it, first switch off the other languages of Streak at risk. If it is the only enabled template, keep it in ไทย and enabled, and create the other language as a new template.',
    );
    expect(text).not.toContain('BACKEND SENTENCE');
  });

  it('says it in Chinese', () => {
    expect(templateFailureText(intlOf(zhCN), refusal(data))).toBe(
      '触发原因“连续记录将断”需要默认语言 ไทย 的启用模板。先启用默认语言的模板；要停用、删除或改掉它，先停用“连续记录将断”下其他语言的模板；它是唯一启用的模板时，保持它为 ไทย 并启用，另建其他语言的新模板。',
    );
  });

  it('names a reason that the language file does not know by its code', () => {
    expect(
      templateFailureText(intlOf(enUS), refusal({ defaultLocale: 'en', reason: 'new_reason' })),
    ).toContain('new_reason needs an enabled template');
  });

  it('falls back to the words of the error code for any other failure', () => {
    expect(templateFailureText(intlOf(enUS), refusal({ x: 1 }))).toBe(
      enUS['error.INVALID_REQUEST'],
    );
  });
});

describe('templateFailureText: a refusal that names a reason', () => {
  const detailed = (reason: string, message = 'BACKEND SENTENCE') =>
    refusal({ details: [{ ref: 'enabled', reason }] }, 'INVALID_REQUEST', message);

  it('adds the words of a reason the page has words for, to the words of the error code', () => {
    const text = templateFailureText(intlOf(enUS), detailed('OUT_OF_RANGE'), { reasons: true });
    expect(text).toContain(enUS['error.INVALID_REQUEST']);
    expect(text).toContain(enUS['reason.OUT_OF_RANGE']);
    expect(text).not.toContain('BACKEND SENTENCE');
  });

  it('does the same in Chinese', () => {
    const text = templateFailureText(intlOf(zhCN), detailed('OUT_OF_RANGE'), { reasons: true });
    expect(text).toContain(zhCN['error.INVALID_REQUEST']);
    expect(text).toContain(zhCN['reason.OUT_OF_RANGE']);
  });

  it('adds nothing for a reason it has no words for: the backend sentence is not shown instead', () => {
    const text = templateFailureText(intlOf(enUS), detailed('SOMETHING_NEW'), { reasons: true });
    expect(text).toBe(enUS['error.INVALID_REQUEST']);
    expect(text).not.toContain('BACKEND SENTENCE');
    expect(text).not.toContain('SOMETHING_NEW');
  });

  it('says each reason once, when several fields name the same one', () => {
    const text = templateFailureText(
      intlOf(enUS),
      refusal({
        details: [
          { ref: 'title', reason: 'OUT_OF_RANGE' },
          { ref: 'body', reason: 'OUT_OF_RANGE' },
        ],
      }),
      { reasons: true },
    );
    expect(text.split(enUS['reason.OUT_OF_RANGE']).length - 1).toBe(1);
  });

  it('leaves the reasons to the fields of a form when the caller does not ask for them', () => {
    const text = templateFailureText(intlOf(enUS), detailed('OUT_OF_RANGE'));
    expect(text).toBe(enUS['error.INVALID_REQUEST']);
  });

  it('keeps the rule of the default language as it is when data has both', () => {
    const text = templateFailureText(
      intlOf(enUS),
      refusal({
        defaultLocale: 'en',
        reason: 'daily_recall',
        details: [{ ref: 'enabled', reason: 'OUT_OF_RANGE' }],
      }),
      { reasons: true },
    );
    expect(text).toContain('Daily recall');
    expect(text).not.toContain(enUS['reason.OUT_OF_RANGE']);
  });
});
