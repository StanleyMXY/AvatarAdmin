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
      'Streak at risk needs an enabled template in the default language (ไทย): enable or keep it first, then change the other languages.',
    );
    expect(text).not.toContain('BACKEND SENTENCE');
  });

  it('says it in Chinese', () => {
    expect(templateFailureText(intlOf(zhCN), refusal(data))).toBe(
      '触发原因“连续记录将断”需要默认语言 ไทย 的启用模板：先启用或保留它，再改其他语言。',
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
