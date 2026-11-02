import { createIntl } from 'react-intl';
import { describe, expect, it } from 'vitest';
import enUS from '../../locales/en-US';
import zhCN from '../../locales/zh-CN';
import { ApiError } from '../../request/errors';
import { protectedFailureText, withScopeHint, withStateHint } from './texts';

const failure = (code: string, httpStatus: number, message = 'words of the backend') =>
  new ApiError({ code, httpStatus, message, data: null });

const english = createIntl({ locale: 'en-US', messages: enUS as Record<string, string> });
const chinese = createIntl({ locale: 'zh-CN', messages: zhCN as Record<string, string> });

describe('the sentences after a refusal of the administrator pages', () => {
  const forbidden = failure('ADMIN_FORBIDDEN', 403);

  it('puts the sentence of the rules after the text of the code, with a full stop between them in Chinese', () => {
    const textZh = chinese.formatMessage({ id: 'error.ADMIN_FORBIDDEN' });
    const hintZh = chinese.formatMessage({ id: 'system.scopeHint' });
    expect(withScopeHint(chinese, forbidden, textZh)).toBe(`${textZh}。${hintZh}`);
    const textEn = english.formatMessage({ id: 'error.ADMIN_FORBIDDEN' });
    const hintEn = english.formatMessage({ id: 'system.scopeHint' });
    expect(withScopeHint(english, forbidden, textEn)).toBe(`${textEn} ${hintEn}`);
  });

  it('puts the same full stop in the inline actions of the administrator page, for 403 and for 409', () => {
    const textZh = chinese.formatMessage({ id: 'error.ADMIN_FORBIDDEN' });
    expect(protectedFailureText(chinese, forbidden, false)).toBe(
      `${textZh}。${chinese.formatMessage({ id: 'system.admins.forbiddenHint' })}`,
    );
    const stateZh = chinese.formatMessage({ id: 'error.INVALID_STATE' });
    expect(protectedFailureText(chinese, failure('INVALID_STATE', 409), false)).toBe(
      `${stateZh}。${chinese.formatMessage({ id: 'system.admins.refusedOtherHint' })}`,
    );
    const textEn = english.formatMessage({ id: 'error.ADMIN_FORBIDDEN' });
    expect(protectedFailureText(english, forbidden, false)).toBe(
      `${textEn} ${english.formatMessage({ id: 'system.admins.forbiddenHint' })}`,
    );
  });

  it('says one of two fixed sentences after a 409 INVALID_STATE, by whether the row is the own one (backend answer 22: the 409 does not say why)', () => {
    const state = failure('INVALID_STATE', 409);
    for (const intl of [english, chinese]) {
      const text = intl.formatMessage({ id: 'error.INVALID_STATE' });
      const own = protectedFailureText(intl, state, true);
      const other = protectedFailureText(intl, state, false);
      expect(own).toContain(text);
      expect(own).toContain(intl.formatMessage({ id: 'system.admins.refusedOwnHint' }));
      expect(own).not.toContain(intl.formatMessage({ id: 'system.admins.refusedOtherHint' }));
      expect(other).toContain(intl.formatMessage({ id: 'system.admins.refusedOtherHint' }));
      expect(other).not.toContain(intl.formatMessage({ id: 'system.admins.refusedOwnHint' }));
      expect(withStateHint(intl, state, text, true)).toBe(own);
    }
    // the sentence of the own row does not blame the last super administrator, and the other does not blame the own account
    expect(english.formatMessage({ id: 'system.admins.refusedOwnHint' })).toMatch(
      /your own account/,
    );
    expect(english.formatMessage({ id: 'system.admins.refusedOtherHint' })).not.toMatch(
      /your own account/,
    );
    expect(english.formatMessage({ id: 'system.admins.refusedOtherHint' })).toMatch(
      /last enabled super administrator/,
    );
  });

  it('does not put the 409 sentences after a 403, and no sentence of the 403 mentions the own account (it is a 409 now)', () => {
    for (const intl of [english, chinese]) {
      expect(protectedFailureText(intl, forbidden, true)).not.toContain(
        intl.formatMessage({ id: 'system.admins.refusedOwnHint' }),
      );
    }
    expect(english.formatMessage({ id: 'system.admins.forbiddenHint' })).not.toMatch(/own account/);
    expect(chinese.formatMessage({ id: 'system.admins.forbiddenHint' })).not.toContain(
      '自己的账号',
    );
  });

  it('adds nothing to another failure and never shows the words of the backend', () => {
    const other = failure('DUPLICATE_RESOURCE', 409);
    const plain = chinese.formatMessage({ id: 'error.DUPLICATE_RESOURCE' });
    expect(withScopeHint(chinese, other, plain)).toBe(plain);
    expect(protectedFailureText(chinese, other, true)).toBe(plain);
    expect(protectedFailureText(chinese, forbidden, false)).not.toContain('words of the backend');
    expect(protectedFailureText(english, forbidden, false)).not.toContain('words of the backend');
  });
});
