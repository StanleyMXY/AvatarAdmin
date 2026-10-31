import { createIntl } from 'react-intl';
import { describe, expect, it } from 'vitest';
import enUS from '../../locales/en-US';
import zhCN from '../../locales/zh-CN';
import { ApiError } from '../../request/errors';
import { protectedFailureText, withScopeHint } from './texts';

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
    expect(protectedFailureText(chinese, forbidden)).toBe(
      `${textZh}。${chinese.formatMessage({ id: 'system.admins.forbiddenHint' })}`,
    );
    const stateZh = chinese.formatMessage({ id: 'error.INVALID_STATE' });
    expect(protectedFailureText(chinese, failure('INVALID_STATE', 409))).toBe(
      `${stateZh}。${chinese.formatMessage({ id: 'system.admins.refusedHint' })}`,
    );
    const textEn = english.formatMessage({ id: 'error.ADMIN_FORBIDDEN' });
    expect(protectedFailureText(english, forbidden)).toBe(
      `${textEn} ${english.formatMessage({ id: 'system.admins.forbiddenHint' })}`,
    );
  });

  it('adds nothing to another failure and never shows the words of the backend', () => {
    const other = failure('DUPLICATE_RESOURCE', 409);
    const plain = chinese.formatMessage({ id: 'error.DUPLICATE_RESOURCE' });
    expect(withScopeHint(chinese, other, plain)).toBe(plain);
    expect(protectedFailureText(chinese, other)).toBe(plain);
    expect(protectedFailureText(chinese, forbidden)).not.toContain('words of the backend');
    expect(protectedFailureText(english, forbidden)).not.toContain('words of the backend');
  });
});
