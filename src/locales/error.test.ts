import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import enError from './en-US/error';
import enReason from './en-US/reason';
import codes from './errorCodes.generated.json';
import zhError from './zh-CN/error';
import zhReason from './zh-CN/reason';

const REASON_CODES = [
  'ACCOUNT_NOT_FOUND',
  'ACCOUNT_NOT_ACTIVE',
  'NOT_HTTPS',
  'INVALID_HOST',
  'INVALID_PORT',
  'INVALID_PATH',
  'TOO_LONG',
  'INVALID_EMAIL',
  'NOT_AN_INTEGER',
  'OUT_OF_RANGE',
  'NOT_BOOLEAN',
  'INVALID_LANGUAGE_TAG',
  'EMPTY_NOT_ALLOWED',
  'INVALID_PATTERN',
];

const LOCAL_CODES = ['NETWORK_ERROR', 'INVALID_RESPONSE', 'UNKNOWN'];

const LANGUAGES = [
  ['zh-CN', zhError, zhReason],
  ['en-US', enError, enReason],
] as const;

describe('errorCodes.generated.json', () => {
  it('lists the codes of the contract table in section 1.4, in order', () => {
    const contract = readFileSync('docs/shared-snapshots/backend-task-java-backend.md', 'utf8');
    const start = contract.indexOf('### 1.4 通用错误码');
    const end = contract.indexOf('### 1.5', start);
    expect(start).toBeGreaterThan(0);
    const fromContract = [
      ...contract.slice(start, end).matchAll(/^\| ([A-Z][A-Z_]+) \| \d{3} \|/gm),
    ].map((m) => m[1]);
    expect(codes).toEqual(fromContract);
  });

  it('has 79 distinct codes, including the four the backend added', () => {
    expect(codes).toHaveLength(79);
    expect(new Set(codes).size).toBe(79);
    for (const added of [
      'METHOD_NOT_ALLOWED',
      'UNSUPPORTED_MEDIA_TYPE',
      'DEPENDENCY_UNAVAILABLE',
      'TEMPORARILY_UNAVAILABLE',
    ]) {
      expect(codes).toContain(added);
    }
  });
});

describe.each(LANGUAGES)('%s error and reason texts', (_name, error, reason) => {
  it.each(codes)('has a non-empty text for error.%s', (code) => {
    expect(error[`error.${code}`]?.trim()).toBeTruthy();
  });

  it.each(LOCAL_CODES)('has a non-empty text for error.%s', (code) => {
    expect(error[`error.${code}`]?.trim()).toBeTruthy();
  });

  it.each(REASON_CODES)('has a non-empty text for reason.%s', (code) => {
    expect(reason[`reason.${code}`]?.trim()).toBeTruthy();
  });

  it('has no entries other than the contract codes, the local codes and the reason codes', () => {
    expect(Object.keys(error).sort()).toEqual(
      [...codes, ...LOCAL_CODES].map((c) => `error.${c}`).sort(),
    );
    expect(Object.keys(reason).sort()).toEqual(REASON_CODES.map((c) => `reason.${c}`).sort());
  });
});

describe('the two languages', () => {
  it('have the same keys', () => {
    expect(Object.keys(zhError).sort()).toEqual(Object.keys(enError).sort());
    expect(Object.keys(zhReason).sort()).toEqual(Object.keys(enReason).sort());
  });

  it('differ in text (nothing is left untranslated)', () => {
    for (const key of Object.keys(zhError)) expect(zhError[key]).not.toBe(enError[key]);
    for (const key of Object.keys(zhReason)) expect(zhReason[key]).not.toBe(enReason[key]);
  });

  it('say the two 503 cases the plan asks for', () => {
    expect(zhError['error.DEPENDENCY_UNAVAILABLE']).toContain('不可用');
    expect(zhError['error.TEMPORARILY_UNAVAILABLE']).toContain('稍后重试');
    expect(enError['error.DEPENDENCY_UNAVAILABLE'].toLowerCase()).toContain('unavailable');
    expect(enError['error.TEMPORARILY_UNAVAILABLE'].toLowerCase()).toContain('try again');
  });

  it('contain no Korean and no raw error code as the whole text', () => {
    const korean = /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/;
    for (const dict of [zhError, enError, zhReason, enReason]) {
      for (const [key, text] of Object.entries(dict)) {
        expect(korean.test(text)).toBe(false);
        expect(text).not.toBe(key.split('.')[1]);
      }
    }
  });
});
