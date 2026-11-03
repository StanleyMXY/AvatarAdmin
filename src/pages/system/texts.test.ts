import { createIntl } from 'react-intl';
import { describe, expect, it } from 'vitest';
import enUS from '../../locales/en-US';
import zhCN from '../../locales/zh-CN';
import { ApiError } from '../../request/errors';
import { protectedFailureText, withScopeHint, withStateHint } from './texts';

const english = createIntl({ locale: 'en-US', messages: enUS as Record<string, string> });
const chinese = createIntl({ locale: 'zh-CN', messages: zhCN as Record<string, string> });

const REASONS = [
  'GRANT_NOT_HELD',
  'ROLE_NOT_HELD',
  'OWN_ROLE',
  'ADMIN_NOT_HELD',
  'SUPER_TARGET',
  'SUPER_FLAG',
] as const;
const refusal = (reason: unknown, message = 'words of the backend') =>
  new ApiError({
    code: 'ADMIN_FORBIDDEN',
    httpStatus: 403,
    message,
    data: reason === undefined ? null : { reason },
  });

describe('the sentence after a 403 ADMIN_FORBIDDEN of the administrator and role writes (data.reason)', () => {
  it('says a different sentence for each of the six reasons, in both languages, after the text of the code', () => {
    for (const intl of [english, chinese]) {
      const text = intl.formatMessage({ id: 'error.ADMIN_FORBIDDEN' });
      const sentences = REASONS.map((reason) => {
        const sentence = intl.formatMessage({ id: `system.refusal.${reason}` });
        expect(sentence, reason).not.toBe(`system.refusal.${reason}`);
        expect(withScopeHint(intl, refusal(reason), text), reason).toBe(
          intl.formatMessage({ id: 'system.sentences' }, { first: text, second: sentence }),
        );
        expect(protectedFailureText(intl, refusal(reason)), reason).toContain(sentence);
        return sentence;
      });
      expect(new Set(sentences).size).toBe(REASONS.length);
    }
  });

  it('puts a full stop between the text of the code and the sentence in Chinese and a space in English', () => {
    const textZh = chinese.formatMessage({ id: 'error.ADMIN_FORBIDDEN' });
    expect(withScopeHint(chinese, refusal('OWN_ROLE'), textZh)).toBe(
      `${textZh}。${chinese.formatMessage({ id: 'system.refusal.OWN_ROLE' })}`,
    );
    const textEn = english.formatMessage({ id: 'error.ADMIN_FORBIDDEN' });
    expect(withScopeHint(english, refusal('OWN_ROLE'), textEn)).toBe(
      `${textEn} ${english.formatMessage({ id: 'system.refusal.OWN_ROLE' })}`,
    );
  });

  it('says the same sentence whichever page asks, so the sentence follows the reason and not the operation', () => {
    for (const reason of REASONS) {
      const text = english.formatMessage({ id: 'error.ADMIN_FORBIDDEN' });
      expect(protectedFailureText(english, refusal(reason))).toBe(
        protectedFailureText(english, refusal(reason)),
      );
      expect(protectedFailureText(english, refusal(reason))).toBe(
        withScopeHint(english, refusal(reason), text),
      );
    }
  });

  it('adds nothing when the 403 has no reason, an unknown reason or a reason that is not text, and never shows the words of the backend', () => {
    for (const intl of [english, chinese]) {
      const text = intl.formatMessage({ id: 'error.ADMIN_FORBIDDEN' });
      for (const reason of [undefined, 'SOMETHING_NEW', 42, null, {}, 'constructor', '__proto__']) {
        expect(withScopeHint(intl, refusal(reason), text), String(reason)).toBe(text);
        expect(protectedFailureText(intl, refusal(reason)), String(reason)).toBe(text);
      }
      for (const reason of REASONS)
        expect(protectedFailureText(intl, refusal(reason))).not.toContain('words of the backend');
    }
  });

  it('does not take a reason from another code', () => {
    const other = new ApiError({
      code: 'DUPLICATE_RESOURCE',
      httpStatus: 409,
      message: 'x',
      data: { reason: 'OWN_ROLE' },
    });
    const plain = chinese.formatMessage({ id: 'error.DUPLICATE_RESOURCE' });
    expect(withScopeHint(chinese, other, plain)).toBe(plain);
    expect(protectedFailureText(chinese, other)).toBe(plain);
  });
});

const STATE_REASONS = ['SELF_PROTECTED', 'LAST_SUPER_ADMIN', 'CONCURRENT_CHANGE'] as const;
const conflict = (reason: unknown, message = 'words of the backend') =>
  new ApiError({
    code: 'INVALID_STATE',
    httpStatus: 409,
    message,
    data: reason === undefined ? { status: 'ACTIVE' } : { status: 'ACTIVE', reason },
  });

describe('the sentence after a 409 INVALID_STATE of the administrator writes (data.reason, data.status stays)', () => {
  it('says a different sentence for each of the three reasons, in both languages, after the text of the code', () => {
    for (const intl of [english, chinese]) {
      const text = intl.formatMessage({ id: 'error.INVALID_STATE' });
      const sentences = STATE_REASONS.map((reason) => {
        const sentence = intl.formatMessage({ id: `system.admins.state.${reason}` });
        expect(sentence, reason).not.toBe(`system.admins.state.${reason}`);
        expect(withStateHint(intl, conflict(reason), text), reason).toBe(
          intl.formatMessage({ id: 'system.sentences' }, { first: text, second: sentence }),
        );
        expect(protectedFailureText(intl, conflict(reason))).toContain(sentence);
        return sentence;
      });
      expect(new Set(sentences).size).toBe(3);
    }
  });

  it('names the own account for SELF_PROTECTED, the last super administrator for LAST_SUPER_ADMIN and a retry for CONCURRENT_CHANGE, and none of them blames the others', () => {
    const word = (reason: string) => english.formatMessage({ id: `system.admins.state.${reason}` });
    expect(word('SELF_PROTECTED')).toMatch(/your own account/);
    expect(word('SELF_PROTECTED')).not.toMatch(/last enabled super administrator|try again/i);
    expect(word('LAST_SUPER_ADMIN')).toMatch(/last enabled super administrator/);
    expect(word('LAST_SUPER_ADMIN')).not.toMatch(/your own account|try again/i);
    expect(word('CONCURRENT_CHANGE')).toMatch(/try again/i);
    expect(word('CONCURRENT_CHANGE')).not.toMatch(/your own account|last enabled/);
    expect(chinese.formatMessage({ id: 'system.admins.state.CONCURRENT_CHANGE' })).toContain(
      '重试',
    );
  });

  it('says the same whether or not the row is the signed-in one: the reason decides, the row does not', () => {
    for (const reason of STATE_REASONS) {
      expect(protectedFailureText(english, conflict(reason))).toBe(
        withStateHint(
          english,
          conflict(reason),
          english.formatMessage({ id: 'error.INVALID_STATE' }),
        ),
      );
    }
  });

  it('adds nothing when the 409 has no reason, an unknown one or one that is not text, and never shows the words of the backend', () => {
    for (const intl of [english, chinese]) {
      const text = intl.formatMessage({ id: 'error.INVALID_STATE' });
      for (const reason of [undefined, 'SOMETHING_NEW', 7, null, {}, 'toString', '__proto__']) {
        expect(withStateHint(intl, conflict(reason), text), String(reason)).toBe(text);
        expect(protectedFailureText(intl, conflict(reason)), String(reason)).toBe(text);
      }
      for (const reason of STATE_REASONS)
        expect(protectedFailureText(intl, conflict(reason))).not.toContain('words of the backend');
    }
  });

  it('does not put a 409 sentence after a 403, nor a 403 sentence after a 409', () => {
    for (const intl of [english, chinese]) {
      const forbidden = protectedFailureText(intl, refusal('OWN_ROLE'));
      for (const reason of STATE_REASONS)
        expect(forbidden).not.toContain(
          intl.formatMessage({ id: `system.admins.state.${reason}` }),
        );
      const state = protectedFailureText(
        intl,
        new ApiError({
          code: 'INVALID_STATE',
          httpStatus: 409,
          message: 'x',
          data: { status: 'ACTIVE', reason: 'OWN_ROLE' },
        }),
      );
      expect(state).toBe(intl.formatMessage({ id: 'error.INVALID_STATE' }));
    }
  });
});
