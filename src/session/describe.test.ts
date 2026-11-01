import { describe, expect, it } from 'vitest';
import enUS from '../locales/en-US';
import zhCN from '../locales/zh-CN';
import { ApiError, describeError, networkError } from '../request/errors';
import { describeFailure } from './describe';

const intlOf = (messages: Record<string, string>) => ({
  messages: messages as Record<string, unknown>,
  formatMessage: ({ id }: { id: string }) => messages[id] ?? id,
});
const en = intlOf(enUS as Record<string, string>);
const zh = intlOf(zhCN as Record<string, string>);

const foreign: [string, unknown][] = [
  ['a TypeError from a page', new TypeError('query parameter "when" must be a string')],
  [
    'a plain Error that carries an address and a token',
    new Error('https://files.example/a.png?sig=abc token=hunter2'),
  ],
  ['an abort', new DOMException('aborted', 'AbortError')],
  ['a string', 'boom'],
  ['null', null],
  ['undefined', undefined],
  ['an object with a code', { code: 'NETWORK_ERROR', message: 'x' }],
];

describe('describeFailure', () => {
  it.each(foreign)(
    'says the same for %s as describeError does: the unknown error, not a network error',
    (_name, failure) => {
      for (const intl of [en, zh]) {
        const t = (key: string) => (intl.messages[key] ? intl.formatMessage({ id: key }) : key);
        const described = describeFailure(intl, failure);
        expect(described.text).toBe(describeError(failure, t).text);
        expect(described.text).toBe(intl.messages['error.UNKNOWN']);
        expect(described.text).not.toBe(intl.messages['error.NETWORK_ERROR']);
        expect(described.fields).toEqual([]);
      }
    },
  );

  it.each(foreign)(
    'returns an error that is an ApiError with the unknown code, never the words of %s',
    (_name, failure) => {
      const { error } = describeFailure(en, failure);
      expect(error).toBeInstanceOf(ApiError);
      expect(error.code).toBe('UNKNOWN');
      expect(error.message).not.toMatch(/hunter2|sig=|files\.example|query parameter/);
      expect(error.details).toEqual([]);
    },
  );

  it('still shows a real network failure of the request layer as a network error', () => {
    const described = describeFailure(en, networkError());
    expect(described.text).toBe(enUS['error.NETWORK_ERROR']);
    expect(described.error.code).toBe('NETWORK_ERROR');
  });

  it('keeps the text and details of an ApiError of the backend', () => {
    const refusal = new ApiError({
      code: 'INVALID_REQUEST',
      httpStatus: 400,
      message: 'words',
      data: { details: [{ ref: 'name', reason: 'TOO_LONG' }] },
    });
    const described = describeFailure(en, refusal);
    expect(described.error).toBe(refusal);
    expect(described.text).toBe(enUS['error.INVALID_REQUEST']);
    expect(described.fields).toEqual([{ ref: 'name', text: enUS['reason.TOO_LONG'] }]);
  });
});
