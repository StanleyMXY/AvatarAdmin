import { createIntl } from 'react-intl';
import { describe, expect, it } from 'vitest';
import enUS from '../../locales/en-US';
import zhCN from '../../locales/zh-CN';
import { ApiError } from '../../request/errors';
import { actionFailure, countText, formatSeconds, labelOf, stateWords } from './text';

const en = createIntl({ locale: 'en-US', messages: enUS, onError: () => {} });
const zh = createIntl({ locale: 'zh-CN', messages: zhCN, onError: () => {} });

const conflict = (status: unknown) =>
  new ApiError({
    code: 'INVALID_STATE',
    httpStatus: 409,
    message: 'backend words',
    data: { status },
  });

describe('labelOf', () => {
  it('translates a known code and shows an unknown one as it came', () => {
    expect(labelOf(en, 'users.status', 'BANNED')).toBe('Banned');
    expect(labelOf(zh, 'users.status', 'BANNED')).toBe('已封禁');
    expect(labelOf(en, 'users.status', 'SUSPENDED')).toBe('SUSPENDED');
  });
  it('shows a dash for nothing, and any other type as text instead of throwing', () => {
    expect(labelOf(en, 'users.status', null)).toBe('—');
    expect(labelOf(en, 'users.status', '')).toBe('—');
    expect(labelOf(en, 'users.status', 42 as unknown as string)).toBe('42');
    expect(labelOf(en, 'users.status', { a: 1 } as unknown as string)).toBe('{"a":1}');
  });
  it('does not read a code that is the name of something on every object', () => {
    expect(labelOf(en, 'users.status', 'constructor')).toBe('constructor');
    expect(labelOf(en, 'users.status', '__proto__')).toBe('__proto__');
  });
});

describe('stateWords', () => {
  it('names the account states and the task states in words', () => {
    expect(stateWords(en, 'PENDING_DELETION')).toBe('Waiting for deletion (grace period)');
    expect(stateWords(zh, 'DELETING')).toBe('删除中');
    expect(stateWords(en, 'FAILED')).toBe('Failed');
    expect(stateWords(en, 'ODD')).toBe('ODD');
  });
});

describe('actionFailure', () => {
  it('says the current state in words for a 409 INVALID_STATE, and not the backend message', () => {
    const text = actionFailure(en, conflict('BANNED'));
    expect(text).toContain(enUS['error.INVALID_STATE']);
    expect(text).toContain('Banned');
    expect(text).not.toContain('backend words');
    expect(actionFailure(zh, conflict('PENDING_DELETION'))).toContain('待删除（宽限期内）');
  });
  it('says it is the task that is in that state when the call is about a deletion task', () => {
    expect(actionFailure(en, conflict('COMPLETED'), 'task')).toBe(
      `${enUS['error.INVALID_STATE']} The task is now: Completed.`,
    );
    expect(actionFailure(zh, conflict('RUNNING'), 'task')).toContain('任务现在的状态：执行中');
    expect(actionFailure(en, conflict('BANNED'))).toContain('The account is now: Banned.');
  });
  it('shows only the translated text of a known code', () => {
    const forbidden = new ApiError({
      code: 'ACCOUNT_DELETING',
      httpStatus: 403,
      message: 'backend words',
      data: null,
    });
    expect(actionFailure(en, forbidden)).toBe(enUS['error.ACCOUNT_DELETING']);
  });
  it('shows the translated text alone when the 409 carries no usable state', () => {
    expect(actionFailure(en, conflict(undefined))).toBe(enUS['error.INVALID_STATE']);
    expect(actionFailure(en, conflict({ nested: true }))).toBe(enUS['error.INVALID_STATE']);
  });
  it('treats anything that is not an ApiError as a network failure', () => {
    expect(actionFailure(en, new Error('x'))).toBe(enUS['error.NETWORK_ERROR']);
  });
});

describe('formatSeconds', () => {
  const f = (n: number | null) => formatSeconds(n, (id, v) => en.formatMessage({ id }, v));
  it('writes seconds, minutes and hours', () => {
    expect(f(45)).toBe('45 s');
    expect(f(200)).toBe('3 min 20 s');
    expect(f(3 * 3600 + 5 * 60 + 9)).toBe('3 h 5 min');
    expect(f(0)).toBe('0 s');
  });
  it('shows a dash for nothing and for a number that cannot be a duration', () => {
    expect(f(null)).toBe('—');
    expect(f(-3)).toBe('—');
    expect(f(Number.NaN)).toBe('—');
  });
});

describe('countText', () => {
  it('shows 0 as 0, nothing as a dash, and a negative or broken count as a dash, never a minus sign', () => {
    expect(countText(0, 'en-US')).toBe('0');
    expect(countText(1234, 'en-US')).toBe('1,234');
    expect(countText(null, 'en-US')).toBe('—');
    expect(countText(undefined, 'en-US')).toBe('—');
    expect(countText(-5, 'en-US')).toBe('—');
    expect(countText(Number.NaN, 'en-US')).toBe('—');
    expect(countText('7' as unknown as number, 'en-US')).toBe('—');
  });
});
